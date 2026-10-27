package br.com.nexusit.support;

import br.com.nexusit.glpi.GlpiService;
import br.com.nexusit.user.Role;
import br.com.nexusit.user.User;
import br.com.nexusit.user.UserRepository;
import br.com.nexusit.whatsapp.EvolutionApiClient;
import jakarta.persistence.EntityNotFoundException;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.multipart.MultipartFile;
import org.springframework.web.server.ResponseStatusException;

import java.io.IOException;

import java.text.Normalizer;
import java.time.Duration;
import java.time.LocalDate;
import java.time.LocalDateTime;
import java.util.ArrayList;
import java.util.Comparator;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Locale;
import java.util.Map;
import java.util.UUID;
import java.util.stream.Collectors;

@Service
@RequiredArgsConstructor
@Slf4j
@Transactional(readOnly = true)
public class SupportService {

    private final SupportConversationRepository conversationRepo;
    private final SupportMessageRepository messageRepo;
    private final SupportConversationTechnicianRepository technicianRepo;
    private final UserRepository userRepository;
    private final GlpiService glpiService;
    private final EvolutionApiClient evolutionApiClient;
    private final BotAtendimentoTiStateStore stateStore;
    private WhatsappAudioConverter audioConverter = new WhatsappAudioConverter();

    public List<SupportConversationSummary> getQueue() {
        return conversationRepo.findQueue().stream().map(c -> summary(c, List.of())).toList();
    }

    public List<SupportConversationSummary> getMine(User user) {
        return conversationRepo.findMine(user.getId()).stream()
                .map(c -> summary(c, List.of()))
                .toList();
    }

    public List<SupportConversationSummary> getAll(int days) {
        LocalDateTime since = LocalDateTime.now().minusDays(Math.max(1, days));
        return conversationRepo.findAllSince(since).stream().map(c -> summary(c, List.of())).toList();
    }

    public SupportDashboardResponse getDashboard(int days) {
        int windowDays = Math.max(1, Math.min(days, 90));
        LocalDateTime now = LocalDateTime.now();
        LocalDateTime since = now.minusDays(windowDays);
        LocalDate today = now.toLocalDate();

        List<SupportConversation> conversations = conversationRepo.findAllSince(since);
        Map<UUID, SupportMessage> lastMessages = new LinkedHashMap<>();
        for (SupportConversation c : conversations) {
            messageRepo.findFirstByConversationIdOrderByCreatedAtDesc(c.getId())
                    .ifPresent(m -> lastMessages.put(c.getId(), m));
        }
        List<SupportConversationSummary> summaries = conversations.stream()
                .map(c -> SupportConversationSummary.from(c, List.of(), lastMessages.get(c.getId()), unreadCount(c)))
                .toList();

        long total = conversations.size();
        long queue = conversations.stream().filter(c -> c.getState() == ConversationState.PENDING_TECH).count();
        long active = conversations.stream().filter(c -> c.getState() == ConversationState.HUMAN_ACTIVE).count();
        long closed = conversations.stream().filter(c -> c.getState() == ConversationState.CLOSED).count();
        long awaiting = conversations.stream().filter(c -> c.getState() == ConversationState.AWAITING_NAME
                || c.getState() == ConversationState.MENU || c.getState() == ConversationState.AWAITING_DESCRIPTION).count();
        long todayCount = conversations.stream().filter(c -> c.getCreatedAt() != null && c.getCreatedAt().toLocalDate().equals(today)).count();
        long withTicket = conversations.stream().filter(c -> c.getGlpiTicketId() != null).count();
        long messages24h = messageRepo.countByCreatedAtGreaterThanEqual(now.minusHours(24));
        long avgWait = Math.round(conversations.stream()
                .filter(c -> c.getClaimedAt() != null && c.getCreatedAt() != null)
                .mapToLong(c -> Duration.between(c.getCreatedAt(), c.getClaimedAt()).toMinutes())
                .average().orElse(0));
        long oldestQueue = conversations.stream()
                .filter(c -> c.getState() == ConversationState.PENDING_TECH && c.getCreatedAt() != null)
                .mapToLong(c -> Duration.between(c.getCreatedAt(), now).toMinutes())
                .max().orElse(0);

        List<SupportDashboardResponse.CountItem> byState = List.of(
                new SupportDashboardResponse.CountItem("PENDING_TECH", "Fila", queue, queue > 0 ? "warning" : "healthy"),
                new SupportDashboardResponse.CountItem("HUMAN_ACTIVE", "Em atendimento", active, "info"),
                new SupportDashboardResponse.CountItem("AWAITING", "No bot/aguardando usuário", awaiting, awaiting > 0 ? "warning" : "muted"),
                new SupportDashboardResponse.CountItem("CLOSED", "Encerrados", closed, "healthy")
        );

        List<SupportDashboardResponse.CountItem> byCategory = groupCounts(summaries.stream()
                .map(s -> inferSupportTopic(s.lastMessagePreview()))
                .toList(), "muted");

        List<SupportDashboardResponse.CountItem> byTechnician = groupCounts(conversations.stream()
                .filter(c -> c.getClaimedBy() != null)
                .map(c -> c.getClaimedBy().getName())
                .toList(), "info");

        List<SupportDashboardResponse.AttentionItem> attention = buildAttention(conversations, summaries, lastMessages, now);
        List<SupportConversationSummary> recent = summaries.stream()
                .sorted(Comparator.comparing((SupportConversationSummary s) ->
                        s.lastMessageAt() != null ? s.lastMessageAt() : s.createdAt(), Comparator.nullsLast(Comparator.naturalOrder())).reversed())
                .limit(12)
                .toList();

        return new SupportDashboardResponse(
                now,
                windowDays,
                new SupportDashboardResponse.Metrics(total, todayCount, queue, active, closed, awaiting, withTicket, messages24h, avgWait, oldestQueue),
                byState,
                byCategory,
                byTechnician,
                attention,
                recent
        );
    }

    public SupportConversationDetail getDetail(UUID id) {
        SupportConversation conversation = getOrThrow(id);
        List<SupportMessageResponse> messages = messageRepo.findByConversation(id).stream()
                .map(SupportMessageResponse::from).toList();
        List<SupportConversationTechnician> extraTechnicians = technicianRepo.findByConversation(id);
        return new SupportConversationDetail(summary(conversation, extraTechnicians), messages);
    }

    private long unreadCount(SupportConversation c) {
        return messageRepo.countByConversationIdAndDirectionAndReadAtIsNull(c.getId(), MessageDirection.IN);
    }

    private SupportConversationSummary summary(SupportConversation c, List<SupportConversationTechnician> technicians) {
        return SupportConversationSummary.from(c, technicians,
                messageRepo.findFirstByConversationIdOrderByCreatedAtDesc(c.getId()).orElse(null), unreadCount(c));
    }

    @Transactional
    public SupportReadResponse markRead(UUID id, User user, UUID throughMessageId) {
        SupportConversation conversation = getOrThrow(id);
        if (user == null) throw new ResponseStatusException(HttpStatus.UNAUTHORIZED);
        // Queue viewers may read unclaimed tickets; active tickets follow reply authorization.
        if (conversation.getClaimedBy() != null) ensureCanReply(conversation, user);
        List<SupportMessage> messages = messageRepo.findByConversation(id);
        if (throughMessageId == null) {
            // A missing cursor cannot prove what the browser displayed: never read unseen arrivals.
            return new SupportReadResponse(true, unread(messages), "UNAVAILABLE", null);
        }
        int end = -1;
        for (int i = 0; i < messages.size(); i++) {
            if (throughMessageId.equals(messages.get(i).getId())) { end = i; break; }
        }
        if (end < 0) throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Mensagem fora deste atendimento");
        LocalDateTime now = LocalDateTime.now();
        List<SupportMessage> displayed = messages.subList(0, end + 1).stream()
                .filter(m -> m.getDirection() == MessageDirection.IN).toList();
        for (SupportMessage m : displayed) {
            if (m.getReadAt() == null) m.setReadAt(now);
        }
        List<SupportMessage> available = displayed.stream().filter(m -> m.getProviderMessageId() != null
                && !m.getProviderMessageId().isBlank() && m.getRemoteJid() != null
                && m.getRemoteJid().endsWith("@s.whatsapp.net") && Boolean.FALSE.equals(m.getFromMe())).toList();
        List<SupportMessage> pending = available.stream().filter(m -> m.getRemoteReadAt() == null).toList();
        for (SupportMessage m : pending) m.setRemoteReadPending(true);
        if (!pending.isEmpty()) {
            List<Map<String, Object>> keys = pending.stream().map(m -> Map.<String, Object>of(
                    "remoteJid", m.getRemoteJid(), "fromMe", false, "id", m.getProviderMessageId())).toList();
            try {
                if (evolutionApiClient.markMessagesRead(keys)) {
                    for (SupportMessage m : pending) { m.setRemoteReadAt(now); m.setRemoteReadPending(false); }
                }
            } catch (Exception ignored) {
                log.warn("Confirmação remota de leitura pendente; nova tentativa apenas em leitura explícita");
            }
        }
        String remote = available.stream().anyMatch(m -> m.getRemoteReadAt() == null) ? "PENDING"
                : available.size() == displayed.size() && !available.isEmpty() ? "CONFIRMED" : "UNAVAILABLE";
        messageRepo.saveAll(displayed);
        return new SupportReadResponse(true, unread(messages), remote,
                displayed.stream().map(SupportMessage::getReadAt).max(Comparator.naturalOrder()).orElse(null));
    }

    private long unread(List<SupportMessage> messages) {
        return messages.stream().filter(m -> m.getDirection() == MessageDirection.IN && m.getReadAt() == null).count();
    }

    public SupportMessageMedia getMessageMedia(UUID messageId) {
        SupportMessage message = messageRepo.findById(messageId)
                .orElseThrow(() -> new EntityNotFoundException("Mensagem não encontrada"));
        if (message.getMediaBytes() == null || message.getMediaBytes().length == 0) {
            throw new ResponseStatusException(HttpStatus.NOT_FOUND, "Mensagem sem mídia");
        }
        return new SupportMessageMedia(message.getMediaBytes(), message.getMediaFilename(), message.getMediaMime());
    }

    @Transactional
    public SupportConversationDetail claim(UUID id, User user) {
        int updated = conversationRepo.claim(id, user, LocalDateTime.now());
        if (updated == 0) {
            throw new ResponseStatusException(HttpStatus.CONFLICT, "Este atendimento já foi assumido por outro técnico");
        }
        SupportConversation conversation = getOrThrow(id);
        String title = supportTitle(user);
        String text = "👨‍💻 " + title + " " + user.getName() + " irá atendê-lo agora. A partir deste momento, você está em atendimento direto.";
        recordMessage(conversation, MessageDirection.OUT, MessageAuthor.HERMES, "Hermes", text);
        evolutionApiClient.sendText(conversation.getContact().getPhoneNumber(), text);
        stateStore.save(conversation);
        if (conversation.getGlpiTicketId() != null) {
            glpiService.addFollowup(conversation.getGlpiTicketId(), "[NexusIT] Atendimento assumido por " + title + " " + user.getName());
            Integer glpiUserId = resolveGlpiUserId(user);
            if (glpiUserId != null) {
                Integer ticketUserId = glpiService.assignTicket(conversation.getGlpiTicketId(), glpiUserId);
                conversation.setGlpiTicketUserId(ticketUserId);
                conversationRepo.save(conversation);
            }
        }
        return getDetail(id);
    }

    @Transactional
    public SupportConversationDetail addTechnician(UUID id, User actingUser, UUID technicianUserId) {
        SupportConversation conversation = getOrThrow(id);
        ensureCanManage(conversation, actingUser);
        if (conversation.getClaimedBy() != null && conversation.getClaimedBy().getId().equals(technicianUserId)) {
            throw new ResponseStatusException(HttpStatus.CONFLICT, "Este técnico já é o responsável pelo atendimento");
        }
        if (technicianRepo.findByConversationIdAndUserId(id, technicianUserId).isPresent()) {
            throw new ResponseStatusException(HttpStatus.CONFLICT, "Técnico já adicionado a este atendimento");
        }
        User technician = userRepository.findById(technicianUserId)
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "Técnico não encontrado"));

        Integer glpiTicketUserId = null;
        if (conversation.getGlpiTicketId() != null) {
            Integer glpiUserId = resolveGlpiUserId(technician);
            if (glpiUserId != null) {
                glpiTicketUserId = glpiService.assignTicket(conversation.getGlpiTicketId(), glpiUserId);
            }
            glpiService.addFollowup(conversation.getGlpiTicketId(), "[NexusIT] " + supportTitle(technician) + " "
                    + technician.getName() + " foi adicionado(a) ao atendimento por " + actingUser.getName() + ".");
        }

        technicianRepo.save(SupportConversationTechnician.builder()
                .conversation(conversation)
                .user(technician)
                .glpiTicketUserId(glpiTicketUserId)
                .build());

        return getDetail(id);
    }

    @Transactional
    public SupportConversationDetail removeTechnician(UUID id, User actingUser, UUID technicianUserId) {
        SupportConversation conversation = getOrThrow(id);
        ensureCanManage(conversation, actingUser);
        SupportConversationTechnician link = technicianRepo.findByConversationIdAndUserId(id, technicianUserId)
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "Técnico não está neste atendimento"));

        if (conversation.getGlpiTicketId() != null) {
            glpiService.unassignTicket(link.getGlpiTicketUserId());
            glpiService.addFollowup(conversation.getGlpiTicketId(), "[NexusIT] " + link.getUser().getName()
                    + " foi removido(a) do atendimento por " + actingUser.getName() + ".");
        }
        technicianRepo.delete(link);
        return getDetail(id);
    }

    @Transactional
    public SupportConversationDetail transfer(UUID id, User actingUser, UUID newTechnicianUserId) {
        SupportConversation conversation = getOrThrow(id);
        ensureCanManage(conversation, actingUser);
        User newTechnician = userRepository.findById(newTechnicianUserId)
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "Técnico não encontrado"));
        User previous = conversation.getClaimedBy();
        if (previous != null && previous.getId().equals(newTechnicianUserId)) {
            throw new ResponseStatusException(HttpStatus.CONFLICT, "Atendimento já está com este técnico");
        }

        if (conversation.getGlpiTicketId() != null) {
            glpiService.unassignTicket(conversation.getGlpiTicketUserId());
            Integer glpiUserId = resolveGlpiUserId(newTechnician);
            Integer newTicketUserId = glpiUserId != null
                    ? glpiService.assignTicket(conversation.getGlpiTicketId(), glpiUserId) : null;
            conversation.setGlpiTicketUserId(newTicketUserId);
            glpiService.addFollowup(conversation.getGlpiTicketId(), "[NexusIT] Atendimento transferido de "
                    + (previous != null ? previous.getName() : "-") + " para " + newTechnician.getName()
                    + " por " + actingUser.getName() + ".");
        }

        conversation.setClaimedBy(newTechnician);
        conversation.setClaimedAt(LocalDateTime.now());
        conversationRepo.save(conversation);
        stateStore.save(conversation);

        String text = "🔁 Seu atendimento foi transferido para " + supportTitle(newTechnician) + " " + newTechnician.getName() + ".";
        recordMessage(conversation, MessageDirection.OUT, MessageAuthor.HERMES, "Hermes", text);
        evolutionApiClient.sendText(conversation.getContact().getPhoneNumber(), text);

        return getDetail(id);
    }

    private void ensureCanManage(SupportConversation conversation, User actingUser) {
        boolean isOwner = conversation.getClaimedBy() != null && conversation.getClaimedBy().getId().equals(actingUser.getId());
        boolean isAdmin = actingUser.getRole() == Role.ADMIN;
        if (!isOwner && !isAdmin) {
            throw new ResponseStatusException(HttpStatus.FORBIDDEN, "Apenas o técnico responsável ou um administrador pode gerenciar este atendimento");
        }
    }

    private void ensureCanReply(SupportConversation conversation, User actingUser) {
        boolean isOwner = conversation.getClaimedBy() != null && conversation.getClaimedBy().getId().equals(actingUser.getId());
        boolean isAdmin = actingUser.getRole() == Role.ADMIN;
        boolean isSecondaryTechnician = technicianRepo.findByConversationIdAndUserId(conversation.getId(), actingUser.getId()).isPresent();
        if (!isOwner && !isAdmin && !isSecondaryTechnician) {
            throw new ResponseStatusException(HttpStatus.FORBIDDEN, "Você não está atribuído a este atendimento");
        }
    }

    private Integer resolveGlpiUserId(User user) {
        if (user.getGlpiUserId() != null) return user.getGlpiUserId();
        return glpiService.findUserByName(user.getName())
                .map(ref -> {
                    user.setGlpiUserId(ref.id());
                    userRepository.save(user);
                    log.info("Vinculado técnico '{}' ao usuário GLPI #{} automaticamente", user.getName(), ref.id());
                    return ref.id();
                })
                .orElseGet(() -> {
                    log.warn("Não foi possível localizar o técnico '{}' no GLPI; atribuição automática pulada", user.getName());
                    return null;
                });
    }

    @Transactional
    public SupportConversationDetail reply(UUID id, User user, String message) {
        return reply(id, user, message, null);
    }

    @Transactional
    public SupportConversationDetail reply(UUID id, User user, String message, MultipartFile file) {
        SupportConversation conversation = getOrThrow(id);
        ensureCanReply(conversation, user);
        if (conversation.getState() != ConversationState.HUMAN_ACTIVE) {
            throw new ResponseStatusException(HttpStatus.CONFLICT, "Este atendimento não está mais ativo");
        }

        String cleanMessage = message == null ? "" : message.trim();
        byte[] bytes = null;
        String filename = null;
        String mime = null;
        String kind = null;
        if (file != null && !file.isEmpty()) {
            if ("audio".equals(mediaKind(file.getContentType())) && !cleanMessage.isBlank()) {
                throw new ResponseStatusException(HttpStatus.BAD_REQUEST,
                        "Envie o texto e o áudio separadamente; áudio não suporta legenda. Nada foi enviado.");
            }
            if (file.getSize() > 32L * 1024 * 1024) {
                throw new ResponseStatusException(HttpStatus.PAYLOAD_TOO_LARGE, "Anexo excede 32 MB");
            }
            try {
                bytes = file.getBytes();
            } catch (IOException e) {
                throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Não foi possível ler o anexo");
            }
            filename = safeFilename(file.getOriginalFilename(), file.getContentType());
            mime = file.getContentType() == null || file.getContentType().isBlank() ? "application/octet-stream" : file.getContentType();
            kind = mediaKind(mime);
            if ("audio".equals(kind)) {
                WhatsappAudioConverter.Audio converted = audioConverter.convert(bytes, filename);
                bytes = converted.bytes();
                filename = converted.filename();
                mime = converted.mime();
                kind = mediaKind(mime);
            }
        }
        if (cleanMessage.isBlank() && (bytes == null || bytes.length == 0)) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Informe uma mensagem ou anexe uma mídia");
        }

        String signedText = signedMessage(user, cleanMessage);
        if (bytes != null && bytes.length > 0) {

            if ("audio".equals(kind)) {
                // A Evolution v2 tem endpoint específico para áudio/voice note. O sendMedia pode retornar ACK,
                // mas alguns clientes WhatsApp não exibem o áudio gravado pelo navegador.
                evolutionApiClient.sendWhatsAppAudioOrThrow(conversation.getContact().getPhoneNumber(), bytes);
            } else {
                evolutionApiClient.sendMediaOrThrow(conversation.getContact().getPhoneNumber(), bytes, filename, mime, cleanMessage.isBlank() ? signedHeader(user) : signedText);
            }
        } else {
            evolutionApiClient.sendTextOrThrow(conversation.getContact().getPhoneNumber(), signedText);
        }

        // Persist only after the provider ACK. Never automatically retry a user send.
        recordMessage(conversation, MessageDirection.OUT, MessageAuthor.TECH, user.getName(), cleanMessage, bytes, filename, mime, kind, null);

        if (conversation.getGlpiTicketId() != null) {
            try {
            String followup = "[" + supportTitle(user) + " " + user.getName() + "]" + (cleanMessage.isBlank() ? " Enviou anexo." : " " + cleanMessage);
            glpiService.addFollowup(conversation.getGlpiTicketId(), followup);
            if (bytes != null && bytes.length > 0) {
                glpiService.uploadDocumentToTicket(conversation.getGlpiTicketId(), bytes, filename, mime);
            }
            } catch (Exception ignored) {
                log.warn("WhatsApp confirmado; sincronização GLPI falhou, sem retry agendado (não repetir envio)");
            }
        }
        return getDetail(id);
    }

    @Transactional
    public SupportConversationDetail close(UUID id) {
        SupportConversation conversation = getOrThrow(id);
        if (conversation.getGlpiTicketId() != null) {
            glpiService.closeTicket(conversation.getGlpiTicketId());
        }
        String text = "✅ Seu chamado foi resolvido! Caso precise de mais ajuda, é só me chamar novamente. Obrigado! 😊";
        recordMessage(conversation, MessageDirection.OUT, MessageAuthor.HERMES, "Hermes", text);
        evolutionApiClient.sendText(conversation.getContact().getPhoneNumber(), text);
        conversation.setState(ConversationState.CLOSED);
        conversation.setClosedAt(LocalDateTime.now());
        conversationRepo.save(conversation);
        stateStore.save(conversation);
        return getDetail(id);
    }

    private SupportConversation getOrThrow(UUID id) {
        return conversationRepo.findByIdWithContact(id)
                .orElseThrow(() -> new EntityNotFoundException("Atendimento não encontrado"));
    }

    private String signedHeader(User user) {
        return "*" + supportTitle(user) + " " + user.getName() + ":*";
    }

    private String signedMessage(User user, String message) {
        return signedHeader(user) + (message == null || message.isBlank() ? "" : " " + message.trim());
    }

    private String supportTitle(User user) {
        if (user.getJobTitle() != null && !user.getJobTitle().isBlank()) return user.getJobTitle().trim();
        return user.getRole() == Role.ADMIN ? "Administrador(a)" : "Técnico(a)";
    }

    private List<SupportDashboardResponse.CountItem> groupCounts(List<String> values, String tone) {
        Map<String, Long> counts = values.stream()
                .filter(v -> v != null && !v.isBlank())
                .collect(Collectors.groupingBy(v -> v, LinkedHashMap::new, Collectors.counting()));
        return counts.entrySet().stream()
                .sorted(Map.Entry.<String, Long>comparingByValue().reversed())
                .limit(8)
                .map(e -> new SupportDashboardResponse.CountItem(e.getKey(), e.getKey(), e.getValue(), tone))
                .toList();
    }

    private List<SupportDashboardResponse.AttentionItem> buildAttention(List<SupportConversation> conversations,
                                                                        List<SupportConversationSummary> summaries,
                                                                        Map<UUID, SupportMessage> lastMessages,
                                                                        LocalDateTime now) {
        Map<UUID, SupportConversationSummary> summaryById = summaries.stream()
                .collect(Collectors.toMap(SupportConversationSummary::id, s -> s));
        List<SupportDashboardResponse.AttentionItem> items = new ArrayList<>();
        for (SupportConversation c : conversations) {
            SupportConversationSummary summary = summaryById.get(c.getId());
            if (summary == null) continue;
            if (c.getState() == ConversationState.PENDING_TECH && c.getCreatedAt() != null) {
                long age = Duration.between(c.getCreatedAt(), now).toMinutes();
                if (age >= 15) {
                    items.add(new SupportDashboardResponse.AttentionItem(
                            c.getId().toString(),
                            age >= 60 ? "Fila parada há mais de 1h" : "Fila aguardando técnico",
                            contactLabel(c) + " · " + (c.getGlpiTicketId() != null ? "Chamado #" + c.getGlpiTicketId() : "sem chamado"),
                            age >= 60 ? "danger" : "warning",
                            age,
                            summary
                    ));
                }
            }
            SupportMessage last = lastMessages.get(c.getId());
            if (c.getState() == ConversationState.HUMAN_ACTIVE && last != null && last.getAuthor() == MessageAuthor.EMPLOYEE) {
                long age = Duration.between(last.getCreatedAt(), now).toMinutes();
                if (age >= 10) {
                    items.add(new SupportDashboardResponse.AttentionItem(
                            c.getId().toString() + ":reply",
                            "Cliente respondeu e aguarda retorno",
                            contactLabel(c) + " · última mensagem há " + age + " min",
                            age >= 30 ? "danger" : "warning",
                            age,
                            summary
                    ));
                }
            }
        }
        return items.stream()
                .sorted(Comparator.comparing(SupportDashboardResponse.AttentionItem::ageMinutes, Comparator.nullsLast(Comparator.reverseOrder())))
                .limit(10)
                .toList();
    }

    private String contactLabel(SupportConversation c) {
        if (c.getContact() == null) return "Contato";
        if (c.getContact().getGlpiUserName() != null && !c.getContact().getGlpiUserName().isBlank()) return c.getContact().getGlpiUserName();
        if (c.getContact().getDisplayName() != null && !c.getContact().getDisplayName().isBlank()) return c.getContact().getDisplayName();
        return c.getContact().getPhoneNumber();
    }

    private String inferSupportTopic(String text) {
        String t = normalizeText(text);
        if (t.contains("impressora") || t.contains("toner") || t.contains("scanner")) return "Impressoras";
        if (t.contains("internet") || t.contains("wifi") || t.contains("wi-fi") || t.contains("rede")) return "Rede/Internet";
        if (t.contains("coletor") || t.contains("palm") || t.contains("android") || t.contains("celular")) return "Coletores/Mobile";
        if (t.contains("winthor") || t.contains("sistema") || t.contains("erp") || t.contains("pdv") || t.contains("caixa")) return "Sistemas/WinThor";
        if (t.contains("email") || t.contains("e-mail")) return "E-mail";
        if (t.contains("senha") || t.contains("acesso") || t.contains("login")) return "Acessos";
        if (t.contains("computador") || t.contains("notebook") || t.contains("monitor")) return "Computadores";
        if (t.isBlank()) return "Sem texto";
        return "Suporte TI";
    }

    private String normalizeText(String s) {
        if (s == null) return "";
        String lower = s.trim().toLowerCase(Locale.ROOT);
        return Normalizer.normalize(lower, Normalizer.Form.NFD).replaceAll("\\p{M}+", "");
    }

    private String mediaKind(String mime) {
        String m = mime == null ? "" : mime.toLowerCase(Locale.ROOT);
        if (m.startsWith("image/")) return "image";
        if (m.startsWith("video/")) return "video";
        if (m.startsWith("audio/")) return "audio";
        return "document";
    }



    private String safeFilename(String original, String mime) {
        if (original != null && !original.isBlank()) {
            return original.replaceAll("[\\r\\n\\t]", "_");
        }
        return switch (mediaKind(mime)) {
            case "image" -> "imagem.png";
            case "video" -> "video.mp4";
            case "audio" -> "audio.webm";
            default -> "documento";
        };
    }

    private void recordMessage(SupportConversation conversation, MessageDirection direction, MessageAuthor author,
                                String authorName, String content) {
        recordMessage(conversation, direction, author, authorName, content, null, null, null, null, null);
    }

    private void recordMessage(SupportConversation conversation, MessageDirection direction, MessageAuthor author,
                                String authorName, String content, byte[] mediaBytes, String mediaFilename,
                                String mediaMime, String mediaKind, String transcription) {
        messageRepo.save(SupportMessage.builder()
                .conversation(conversation)
                .direction(direction)
                .author(author)
                .authorName(authorName)
                .content(content)
                .mediaBytes(mediaBytes)
                .mediaFilename(mediaFilename)
                .mediaMime(mediaMime)
                .mediaKind(mediaKind)
                .transcription(transcription)
                .build());
    }
}
