package br.com.nexusit.support;

import br.com.nexusit.glpi.GlpiService;
import br.com.nexusit.glpi.GlpiTicket;
import br.com.nexusit.glpi.GlpiUserRef;
import br.com.nexusit.push.PushNotificationService;
import br.com.nexusit.whatsapp.EvolutionApiClient;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.text.Normalizer;
import java.time.Duration;
import java.time.LocalDateTime;
import java.util.List;
import java.util.Locale;
import java.util.Map;
import java.util.concurrent.atomic.AtomicBoolean;

/**
 * Bot de atendimento TI do Armazém Galdino para a instância Evolution API "ti-galdino".
 * Fluxo: identifica usuário no GLPI, mostra menu, abre/consulta chamados e silencia
 * quando um técnico assume o atendimento no NexusIT CRM.
 */
@Service
@RequiredArgsConstructor
@Slf4j
public class SupportConversationEngine {

    private static final String FIRST_CONTACT_TEXT = "Olá! 👋 Sou o atendimento automático do TI Galdino.\n\nPara começar, me informe seu *nome completo*.";
    private static final String MENU_TEMPLATE = "Olá, %s! Como posso te ajudar?\n\n" +
            "1️⃣ Abrir chamado\n" +
            "2️⃣ Consultar meus chamados\n" +
            "3️⃣ Falar com um técnico\n" +
            "0️⃣ Encerrar\n\n" +
            "Se preferir, pode escrever direto o problema. Ex.: _coletor desconectou_, _sistema travou_, _sem internet_, _impressora parada_.";
    private static final String ASK_DESCRIPTION = "Certo. Me envie o que está acontecendo em uma mensagem só, se puder:\n\n" +
            "• qual sistema/equipamento;\n" +
            "• setor/local;\n" +
            "• desde quando acontece;\n" +
            "• se é só com você ou com mais pessoas.\n\n" +
            "Pode mandar foto, vídeo ou áudio também. 📷🎧";
    private static final String WAIT_TECH = "Certo, vou colocar seu atendimento na fila para um técnico assumir. Se for urgente, envie também o setor/local e o impacto.";
    private static final String CLOSED_TEXT = "✅ Atendimento encerrado. Se precisar de mais alguma coisa, é só me chamar novamente.";
    private static final String EXPIRED_TEXT = "Seu atendimento anterior expirou por inatividade. Vou iniciar um novo atendimento, tudo bem?";
    private static final Duration MENU_TIMEOUT = Duration.ofMinutes(60);
    private static final Duration DESCRIPTION_TIMEOUT = Duration.ofHours(2);
    private static final Duration HUMAN_ACTIVE_TIMEOUT = Duration.ofDays(7);

    private final WhatsappContactRepository contactRepo;
    private final SupportConversationRepository conversationRepo;
    private final SupportMessageRepository messageRepo;
    private final SupportConversationTechnicianRepository technicianRepo;
    private final GlpiService glpiService;
    private final EvolutionApiClient evolutionApiClient;
    private final BotAtendimentoTiStateStore stateStore;
    private final AudioTranscriptionService audioTranscriptionService;
    private final PushNotificationService pushNotificationService;

    @Transactional
    public void onInboundMessage(InboundWhatsappMessage msg) {
        WhatsappContact contact = contactRepo.findByPhoneNumber(msg.phoneNumber())
                .orElseGet(() -> contactRepo.save(WhatsappContact.builder()
                        .phoneNumber(msg.phoneNumber())
                        .displayName(msg.pushName())
                        .build()));

        AtomicBoolean isNewConversation = new AtomicBoolean(false);
        SupportConversation conversation = conversationRepo.findLatestOpenByContact(contact.getId())
                .orElseGet(() -> {
                    isNewConversation.set(true);
                    return conversationRepo.save(SupportConversation.builder()
                            .contact(contact)
                            .state(contact.getGlpiUserId() == null ? ConversationState.AWAITING_NAME : ConversationState.MENU)
                            .build());
                });

        String transcription = transcribeIfAudio(msg);

        if (!isNewConversation.get() && isExpired(conversation, LocalDateTime.now())) {
            conversation = expireAndStartNewConversation(conversation, contact, msg, transcription);
            persistState(conversation);
            return;
        }

        recordInboundMessage(conversation, contact, msg, transcription);

        if (!isNewConversation.get() && conversation.getState() == ConversationState.HUMAN_ACTIVE) {
            notifyTechniciansOfNewMessage(conversation, contact, msg, transcription);
        }

        if (isNewConversation.get()) {
            if (conversation.getState() == ConversationState.AWAITING_NAME) {
                sendAndRecord(conversation, FIRST_CONTACT_TEXT);
            } else {
                sendAndRecord(conversation, menuText(contact.getGlpiUserName()));
            }
            persistState(conversation);
            return;
        }

        switch (conversation.getState()) {
            case AWAITING_NAME -> handleAwaitingName(conversation, contact, msg, transcription);
            case MENU -> handleMenu(conversation, contact, msg);
            case AWAITING_DESCRIPTION -> handleAwaitingDescription(conversation, contact, msg, transcription);
            case PENDING_TECH, HUMAN_ACTIVE -> appendFollowupOnly(conversation, msg, transcription);
            case CLOSED -> log.debug("Mensagem recebida para conversa já fechada {}", conversation.getId());
        }
        persistState(conversation);
    }

    private boolean isExpired(SupportConversation conversation, LocalDateTime now) {
        Duration timeout = timeoutFor(conversation.getState());
        if (timeout == null || conversation.getId() == null) return false;
        LocalDateTime lastActivity = messageRepo.findFirstByConversationIdOrderByCreatedAtDesc(conversation.getId())
                .map(SupportMessage::getCreatedAt)
                .orElse(conversation.getCreatedAt());
        return lastActivity != null && lastActivity.plus(timeout).isBefore(now);
    }

    private Duration timeoutFor(ConversationState state) {
        if (state == null) return null;
        return switch (state) {
            case AWAITING_NAME, MENU -> MENU_TIMEOUT;
            case AWAITING_DESCRIPTION -> DESCRIPTION_TIMEOUT;
            case HUMAN_ACTIVE -> HUMAN_ACTIVE_TIMEOUT;
            case PENDING_TECH, CLOSED -> null;
        };
    }

    private SupportConversation expireAndStartNewConversation(SupportConversation expiredConversation, WhatsappContact contact,
                                                               InboundWhatsappMessage msg, String transcription) {
        expiredConversation.setState(ConversationState.CLOSED);
        expiredConversation.setClosedAt(LocalDateTime.now());
        conversationRepo.save(expiredConversation);
        persistState(expiredConversation);

        SupportConversation newConversation = conversationRepo.save(SupportConversation.builder()
                .contact(contact)
                .state(contact.getGlpiUserId() == null ? ConversationState.AWAITING_NAME : ConversationState.MENU)
                .build());

        recordInboundMessage(newConversation, contact, msg, transcription);
        sendAndRecord(newConversation, EXPIRED_TEXT);
        if (newConversation.getState() == ConversationState.AWAITING_NAME) {
            sendAndRecord(newConversation, FIRST_CONTACT_TEXT);
        } else {
            sendAndRecord(newConversation, menuText(contact.getGlpiUserName()));
        }
        return newConversation;
    }

    private void handleAwaitingName(SupportConversation conversation, WhatsappContact contact, InboundWhatsappMessage msg, String transcription) {
        String name = firstNonBlank(msg.text(), transcription).trim();
        if (name.isBlank()) {
            sendAndRecord(conversation, "Não entendi. Pode me dizer seu nome completo?");
            return;
        }

        GlpiUserRef user = glpiService.findUserByName(name).orElseGet(() -> glpiService.createUser(name));
        glpiService.linkWhatsappToUser(user.id(), contact.getPhoneNumber());
        contact.setGlpiUserId(user.id());
        contact.setGlpiUserName(user.name());
        contactRepo.save(contact);

        conversation.setState(ConversationState.MENU);
        conversationRepo.save(conversation);
        sendAndRecord(conversation, menuText(user.name()));
    }

    private void handleMenu(SupportConversation conversation, WhatsappContact contact, InboundWhatsappMessage msg) {
        String text = normalize(msg.text());
        if (text.equals("1") || text.contains("abrir") || text.contains("chamado") || text.contains("suporte")) {
            conversation.setState(ConversationState.AWAITING_DESCRIPTION);
            conversationRepo.save(conversation);
            sendAndRecord(conversation, ASK_DESCRIPTION);
            return;
        }
        if (text.equals("2") || text.contains("consultar") || text.contains("meus chamados")) {
            sendAndRecord(conversation, formatOpenTickets(contact));
            return;
        }
        if (text.equals("3") || text.contains("tecnico") || text.contains("técnico") || text.contains("atendente")) {
            sendAndRecord(conversation, WAIT_TECH);
            int ticketId = glpiService.createTicket(
                    "Atendimento direto com técnico via WhatsApp",
                    "Funcionário solicitou falar diretamente com um técnico pelo WhatsApp corporativo do TI Galdino.",
                    contact.getGlpiUserId(),
                    4,
                    inferCategory("falar com técnico atendimento urgente")
            );
            conversation.setGlpiTicketId(ticketId);
            conversation.setState(ConversationState.PENDING_TECH);
            conversationRepo.save(conversation);
            notifyQueueOfNewTicket(conversation, contact, ticketId);
            sendAndRecord(conversation, "✅ Solicitação urgente registrada no chamado #" + ticketId + ". Um técnico irá assumir em breve.");
            return;
        }
        if (text.equals("0") || text.contains("encerrar") || text.contains("sair")) {
            conversation.setState(ConversationState.CLOSED);
            conversationRepo.save(conversation);
            sendAndRecord(conversation, CLOSED_TEXT);
            return;
        }
        if (looksLikeSupportRequest(msg)) {
            handleDirectSupportRequest(conversation, contact, msg, "");
            return;
        }
        sendAndRecord(conversation, "Não consegui identificar a opção.\n\n" + menuText(contact.getGlpiUserName()));
    }

    private void handleDirectSupportRequest(SupportConversation conversation, WhatsappContact contact, InboundWhatsappMessage msg, String transcription) {
        String description = descriptionFrom(msg, transcription);
        int priority = inferPriority(description);
        int ticketId = glpiService.createTicket(
                autoTitle(description),
                structuredTicketDescription(contact, description, inferCategory(description), priority),
                contact.getGlpiUserId(),
                priority,
                inferCategory(description)
        );
        conversation.setGlpiTicketId(ticketId);
        conversation.setState(ConversationState.PENDING_TECH);
        conversationRepo.save(conversation);
        attachMediaIfAny(ticketId, msg);
        notifyQueueOfNewTicket(conversation, contact, ticketId);
        sendAndRecord(conversation, openedTicketText(ticketId, priority));
    }

    private boolean looksLikeSupportRequest(InboundWhatsappMessage msg) {
        String text = normalize(msg.text());
        if (msg.hasMedia()) return true;
        if (text.length() < 8) return false;
        if (text.matches("^[0-9]+$")) return false;
        return text.contains("parou") || text.contains("nao funciona") || text.contains("não funciona")
                || text.contains("travou") || text.contains("erro") || text.contains("falha")
                || text.contains("sem ") || text.contains("lento") || text.contains("lenta")
                || text.contains("impressora") || text.contains("coletor") || text.contains("winthor")
                || text.contains("internet") || text.contains("wifi") || text.contains("wi-fi")
                || text.contains("sistema") || text.contains("senha") || text.contains("login")
                || text.contains("acesso") || text.contains("computador") || text.contains("notebook")
                || text.contains("email") || text.contains("e-mail");
    }

    private void handleAwaitingDescription(SupportConversation conversation, WhatsappContact contact, InboundWhatsappMessage msg, String transcription) {
        if (conversation.getGlpiTicketId() == null) {
            String description = descriptionFrom(msg, transcription);
            int priority = inferPriority(description);
            String category = inferCategory(description);
            int ticketId = glpiService.createTicket(
                    autoTitle(description),
                    structuredTicketDescription(contact, description, category, priority),
                    contact.getGlpiUserId(),
                    priority,
                    category
            );
            conversation.setGlpiTicketId(ticketId);
            conversation.setState(ConversationState.PENDING_TECH);
            conversationRepo.save(conversation);
            attachMediaIfAny(ticketId, msg);
            notifyQueueOfNewTicket(conversation, contact, ticketId);
            sendAndRecord(conversation, openedTicketText(ticketId, priority));
        } else {
            appendFollowupOnly(conversation, msg, transcription);
        }
    }

    private void appendFollowupOnly(SupportConversation conversation, InboundWhatsappMessage msg, String transcription) {
        if (conversation.getGlpiTicketId() == null) return;
        attachMediaIfAny(conversation.getGlpiTicketId(), msg);
        String followup = followupFrom(msg, transcription);
        if (!followup.isBlank()) glpiService.addFollowup(conversation.getGlpiTicketId(), followup);
    }

    private String formatOpenTickets(WhatsappContact contact) {
        if (contact.getGlpiUserId() == null) return "Ainda não localizei seu cadastro. Me informe seu nome completo.";
        List<GlpiTicket> tickets = glpiService.getOpenTicketsForRequester(contact.getGlpiUserId());
        if (tickets.isEmpty()) return "Você não possui chamados abertos no momento.";
        StringBuilder sb = new StringBuilder("Seus chamados abertos:\n");
        for (GlpiTicket t : tickets) {
            sb.append("#").append(t.id()).append(" - ").append(t.title())
                    .append(" — ").append(t.statusLabel()).append("\n");
        }
        return sb.toString().trim();
    }

    private void attachMediaIfAny(int ticketId, InboundWhatsappMessage msg) {
        if (msg.hasMedia()) glpiService.uploadDocumentToTicket(ticketId, msg.mediaBytes(), msg.mediaFilename(), msg.mediaMime());
    }

    private void sendAndRecord(SupportConversation conversation, String text) {
        recordMessage(conversation, MessageDirection.OUT, MessageAuthor.HERMES, "Hermes", text,
                null, null, null, null, null);
        evolutionApiClient.sendText(conversation.getContact().getPhoneNumber(), text);
    }

    private void recordInboundMessage(SupportConversation conversation, WhatsappContact contact,
                                      InboundWhatsappMessage msg, String transcription) {
        recordMessage(conversation, MessageDirection.IN, MessageAuthor.EMPLOYEE,
                employeeDisplayName(contact, msg), inboundContent(msg, transcription),
                msg.mediaBytes(), msg.mediaFilename(), msg.mediaMime(), msg.mediaKind(), transcription);
    }

    private void notifyTechniciansOfNewMessage(SupportConversation conversation, WhatsappContact contact,
                                               InboundWhatsappMessage msg, String transcription) {
        String from = employeeDisplayName(contact, msg);
        String content = inboundContent(msg, transcription);
        String preview = content.isBlank() ? "Enviou uma mensagem" : content;
        final String body = preview.length() > 140 ? preview.substring(0, 140) + "…" : preview;
        String title = "Nova mensagem — " + from;
        Map<String, String> data = Map.of("conversationId", conversation.getId().toString(), "type", "support_message");

        if (conversation.getClaimedBy() != null) {
            pushNotificationService.sendToUser(conversation.getClaimedBy().getId(), title, body, data);
        }
        technicianRepo.findByConversation(conversation.getId())
                .forEach(t -> pushNotificationService.sendToUser(t.getUser().getId(), title, body, data));
    }

    private void notifyQueueOfNewTicket(SupportConversation conversation, WhatsappContact contact, int ticketId) {
        String from = contact.getGlpiUserName() != null && !contact.getGlpiUserName().isBlank()
                ? contact.getGlpiUserName() : contact.getDisplayName();
        String body = (from == null || from.isBlank() ? "Alguém" : from) + " está aguardando atendimento";
        Map<String, String> data = Map.of("conversationId", conversation.getId().toString(), "type", "support_queue");
        pushNotificationService.broadcastToAllDevices("Novo chamado na fila — #" + ticketId, body, data);
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
                .transcription(transcription == null || transcription.isBlank() ? null : transcription)
                .build());
    }

    private void persistState(SupportConversation conversation) { stateStore.save(conversation); }

    private String menuText(String fullName) { return String.format(MENU_TEMPLATE, firstName(fullName)); }

    private String employeeDisplayName(WhatsappContact contact, InboundWhatsappMessage msg) {
        if (contact.getGlpiUserName() != null && !contact.getGlpiUserName().isBlank()) return contact.getGlpiUserName();
        if (msg.pushName() != null && !msg.pushName().isBlank()) return msg.pushName();
        return contact.getPhoneNumber();
    }

    private String inboundContent(InboundWhatsappMessage msg, String transcription) {
        if (msg.hasText()) return msg.text();
        if (msg.isAudio() && transcription != null && !transcription.isBlank()) return "🎧 Áudio transcrito:\n" + transcription;
        if (msg.hasMedia()) return "[Mídia recebida: " + msg.mediaFilename() + "]";
        return "";
    }

    private String descriptionFrom(InboundWhatsappMessage msg, String transcription) {
        if (msg.hasText()) return msg.text();
        if (msg.isAudio() && transcription != null && !transcription.isBlank()) {
            return "Funcionário enviou áudio via WhatsApp.\n\nTranscrição:\n" + transcription;
        }
        if (msg.hasMedia()) return "(sem descrição em texto — mídia recebida pelo WhatsApp: " + msg.mediaFilename() + ")";
        return "(sem descrição em texto)";
    }

    private String followupFrom(InboundWhatsappMessage msg, String transcription) {
        if (msg.hasText()) return "[WhatsApp] " + msg.text();
        if (msg.isAudio() && transcription != null && !transcription.isBlank()) {
            return "[WhatsApp áudio transcrito] " + transcription;
        }
        if (msg.hasMedia()) return "[WhatsApp] Mídia recebida: " + msg.mediaFilename();
        return "";
    }

    private String transcribeIfAudio(InboundWhatsappMessage msg) {
        if (!msg.isAudio() || !msg.hasMedia()) return "";
        return audioTranscriptionService.transcribe(msg.mediaBytes(), msg.mediaFilename(), msg.mediaMime());
    }

    private String firstName(String fullName) {
        return fullName == null || fullName.isBlank() ? "" : fullName.trim().split("\\s+")[0];
    }

    private String autoTitle(String description) {
        String oneLine = description.replaceAll("\\s+", " ").trim();
        if (oneLine.isBlank()) return "Chamado via WhatsApp";
        String[] words = oneLine.split(" ");
        StringBuilder title = new StringBuilder();
        for (String w : words) {
            if (title.length() + w.length() + 1 > 70) break;
            if (!title.isEmpty()) title.append(' ');
            title.append(w);
            if (title.toString().split(" ").length >= 10) break;
        }
        return title.isEmpty() ? "Chamado via WhatsApp" : title.toString();
    }

    private String inferCategory(String description) {
        String t = normalize(description);
        if (t.contains("impressora") || t.contains("toner") || t.contains("scanner")) return "Impressoras";
        if (t.contains("internet") || t.contains("wifi") || t.contains("wi-fi") || t.contains("rede")) return "Rede/Internet";
        if (t.contains("coletor") || t.contains("palm") || t.contains("android") || t.contains("celular")) return "Coletores/Mobile";
        if (t.contains("winthor") || t.contains("sistema") || t.contains("erp") || t.contains("pdv") || t.contains("caixa")) return "Sistemas/WinThor";
        if (t.contains("email") || t.contains("e-mail")) return "E-mail";
        if (t.contains("senha") || t.contains("acesso") || t.contains("login")) return "Acessos";
        if (t.contains("computador") || t.contains("notebook") || t.contains("monitor") || t.contains("teclado") || t.contains("mouse")) return "Computadores";
        return "Suporte TI";
    }

    private int inferPriority(String description) {
        String t = normalize(description);
        if (t.contains("urgente") || t.contains("parado geral") || t.contains("todos parados")
                || t.contains("loja parada") || t.contains("sem internet") || t.contains("internet caiu")
                || t.contains("sistema fora") || t.contains("winthor fora") || t.contains("pdv parado")
                || t.contains("caixa parado") || t.contains("nao vende") || t.contains("não vende")) {
            return 4;
        }
        if (t.contains("parou") || t.contains("nao funciona") || t.contains("não funciona")
                || t.contains("travou") || t.contains("erro") || t.contains("falha")
                || t.contains("sem acesso") || t.contains("coletor desconect")) {
            return 3;
        }
        return 3;
    }

    private String priorityLabel(int priority) {
        return switch (priority) {
            case 4 -> "Alta";
            case 5 -> "Muito alta";
            default -> "Média";
        };
    }

    private String openedTicketText(int ticketId, int priority) {
        return "✅ Chamado #" + ticketId + " aberto com sucesso.\n\n" +
                "Prioridade inicial: *" + priorityLabel(priority) + "*.\n" +
                "Um técnico irá assumir pelo NexusIT. Se lembrar de mais algum detalhe, pode enviar aqui que será anexado ao chamado.";
    }

    private String structuredTicketDescription(WhatsappContact contact, String description, String category, int priority) {
        String requester = contact.getGlpiUserName() != null && !contact.getGlpiUserName().isBlank()
                ? contact.getGlpiUserName() : contact.getDisplayName();
        return "Origem: WhatsApp TI Galdino\n" +
                "Solicitante: " + firstNonBlank(requester, contact.getPhoneNumber()) + "\n" +
                "Telefone: " + contact.getPhoneNumber() + "\n" +
                "Categoria sugerida: " + category + "\n" +
                "Prioridade sugerida: " + priorityLabel(priority) + "\n\n" +
                "Relato do usuário:\n" + description + "\n\n" +
                "Checklist inicial sugerido:\n" + suggestedChecklist(category, description);
    }

    private String suggestedChecklist(String category, String description) {
        String t = normalize(category + " " + description);
        if (t.contains("rede") || t.contains("internet") || t.contains("wifi")) {
            return "- confirmar setor/local afetado;\n- testar conectividade do equipamento;\n- verificar AP/switch/porta no NexusIT/Zabbix;\n- validar se há outros usuários afetados.";
        }
        if (t.contains("impressora")) {
            return "- confirmar impressora/setor;\n- verificar fila de impressão e conexão;\n- checar papel/toner/erro no painel;\n- testar impressão de outro computador.";
        }
        if (t.contains("coletor") || t.contains("mobile")) {
            return "- confirmar MAC/nome do coletor e setor;\n- verificar Wi-Fi/AP conectado no painel UniFi;\n- testar login/aplicativo;\n- diferenciar falha de rede x falha do sistema.";
        }
        if (t.contains("winthor") || t.contains("sistema") || t.contains("pdv")) {
            return "- confirmar módulo/tela e mensagem de erro;\n- verificar se afeta um usuário ou todos;\n- testar conexão com servidor/sistema;\n- registrar evidência ou print.";
        }
        if (t.contains("acesso") || t.contains("senha") || t.contains("login")) {
            return "- confirmar sistema afetado;\n- validar usuário/cadastro;\n- não solicitar senha pelo WhatsApp;\n- tratar redefinição conforme política interna.";
        }
        return "- confirmar setor/local;\n- identificar equipamento/sistema afetado;\n- verificar impacto e quantidade de usuários;\n- pedir evidência se necessário.";
    }

    private String normalize(String s) {
        if (s == null) return "";
        String lower = s.trim().toLowerCase(Locale.ROOT);
        return Normalizer.normalize(lower, Normalizer.Form.NFD).replaceAll("\\p{M}+", "");
    }

    private String firstNonBlank(String a, String b) {
        return a != null && !a.isBlank() ? a : b != null ? b : "";
    }
}
