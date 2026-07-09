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

    private static final String FIRST_CONTACT_TEXT = "Olá! 👋 Bem-vindo ao suporte TI do Armazém Galdino. Por favor, me informe seu nome completo.";
    private static final String MENU_TEMPLATE = "Olá %s! Como posso te ajudar?\n" +
            "1️⃣ Abrir chamado de suporte\n" +
            "2️⃣ Consultar meus chamados\n" +
            "3️⃣ Falar com um técnico\n" +
            "0️⃣ Encerrar atendimento";
    private static final String ASK_DESCRIPTION = "Por favor, descreva seu problema. Você pode enviar fotos, vídeos ou áudio 📷🎧";
    private static final String WAIT_TECH = "Aguarde um momento, estou verificando a disponibilidade dos técnicos...";
    private static final String CLOSED_TEXT = "Atendimento encerrado. Caso precise de mais ajuda, é só me chamar novamente. Obrigado! 😊";

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
        sendAndRecord(conversation, "Não entendi sua opção.\n\n" + menuText(contact.getGlpiUserName()));
    }

    private void handleAwaitingDescription(SupportConversation conversation, WhatsappContact contact, InboundWhatsappMessage msg, String transcription) {
        if (conversation.getGlpiTicketId() == null) {
            String description = descriptionFrom(msg, transcription);
            int ticketId = glpiService.createTicket(
                    autoTitle(description),
                    description,
                    contact.getGlpiUserId(),
                    3,
                    inferCategory(description)
            );
            conversation.setGlpiTicketId(ticketId);
            conversation.setState(ConversationState.PENDING_TECH);
            conversationRepo.save(conversation);
            attachMediaIfAny(ticketId, msg);
            notifyQueueOfNewTicket(conversation, contact, ticketId);
            sendAndRecord(conversation, "✅ Chamado #" + ticketId + " aberto com sucesso! Um técnico irá atendê-lo em breve. Você será notificado aqui quando seu chamado for atendido.");
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
        if (t.contains("winthor") || t.contains("sistema") || t.contains("erp")) return "Sistemas/WinThor";
        if (t.contains("email") || t.contains("e-mail")) return "E-mail";
        if (t.contains("senha") || t.contains("acesso") || t.contains("login")) return "Acessos";
        return "Suporte TI";
    }

    private String normalize(String s) {
        return s == null ? "" : s.trim().toLowerCase(Locale.ROOT);
    }

    private String firstNonBlank(String a, String b) {
        return a != null && !a.isBlank() ? a : b != null ? b : "";
    }
}
