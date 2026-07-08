package br.com.nexusit.support;

import br.com.nexusit.glpi.GlpiService;
import br.com.nexusit.glpi.GlpiUserRef;
import br.com.nexusit.whatsapp.EvolutionApiClient;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.Locale;
import java.util.concurrent.atomic.AtomicBoolean;

/**
 * Drives the scripted (non-AI) intake flow: identify the contact against GLPI,
 * present a menu, collect a problem description, open a ticket, and stay silent
 * once a technician has claimed the conversation from the CRM queue.
 */
@Service
@RequiredArgsConstructor
@Slf4j
public class SupportConversationEngine {

    private static final String MENU_TEXT = "O que você deseja?\n1 - Abrir chamado";

    private final WhatsappContactRepository contactRepo;
    private final SupportConversationRepository conversationRepo;
    private final SupportMessageRepository messageRepo;
    private final GlpiService glpiService;
    private final EvolutionApiClient evolutionApiClient;

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

        recordMessage(conversation, MessageDirection.IN, MessageAuthor.EMPLOYEE,
                employeeDisplayName(contact, msg), msg.text());

        if (isNewConversation.get()) {
            if (conversation.getState() == ConversationState.AWAITING_NAME) {
                sendAndRecord(conversation, "Olá! Sou o Hermes, assistente de TI. Para começar, qual o seu nome completo?");
            } else {
                sendAndRecord(conversation, "Olá, " + firstName(contact.getGlpiUserName()) + "! " + MENU_TEXT);
            }
            return;
        }

        switch (conversation.getState()) {
            case AWAITING_NAME -> handleAwaitingName(conversation, contact, msg);
            case MENU -> handleMenu(conversation, msg);
            case AWAITING_DESCRIPTION -> handleAwaitingDescription(conversation, contact, msg);
            case PENDING_TECH, HUMAN_ACTIVE -> appendFollowupOnly(conversation, msg);
            case CLOSED -> log.debug("Mensagem recebida para conversa já fechada {}", conversation.getId());
        }
    }

    private void handleAwaitingName(SupportConversation conversation, WhatsappContact contact, InboundWhatsappMessage msg) {
        String name = msg.text() == null ? "" : msg.text().trim();
        if (name.isBlank()) {
            sendAndRecord(conversation, "Não entendi. Pode me dizer seu nome completo?");
            return;
        }

        GlpiUserRef user = glpiService.findUserByName(name).orElseGet(() -> glpiService.createUser(name));
        contact.setGlpiUserId(user.id());
        contact.setGlpiUserName(user.name());
        contactRepo.save(contact);

        conversation.setState(ConversationState.MENU);
        conversationRepo.save(conversation);
        sendAndRecord(conversation, "Prazer, " + firstName(user.name()) + "! " + MENU_TEXT);
    }

    private void handleMenu(SupportConversation conversation, InboundWhatsappMessage msg) {
        String text = (msg.text() == null ? "" : msg.text().trim().toLowerCase(Locale.ROOT));
        if (text.contains("1") || text.contains("abrir") || text.contains("chamado")) {
            conversation.setState(ConversationState.AWAITING_DESCRIPTION);
            conversationRepo.save(conversation);
            sendAndRecord(conversation, "Descreva seu problema. Você também pode enviar fotos ou vídeos junto.");
        } else {
            sendAndRecord(conversation, "Não entendi.\n\n" + MENU_TEXT);
        }
    }

    private void handleAwaitingDescription(SupportConversation conversation, WhatsappContact contact, InboundWhatsappMessage msg) {
        if (conversation.getGlpiTicketId() == null) {
            String description = msg.hasText() ? msg.text() : "(sem descrição em texto — ver mídia anexada)";
            int ticketId = glpiService.createTicket(autoTitle(description), description, contact.getGlpiUserId());
            conversation.setGlpiTicketId(ticketId);
            conversation.setState(ConversationState.PENDING_TECH);
            conversationRepo.save(conversation);
            attachMediaIfAny(ticketId, msg);
            sendAndRecord(conversation, "Chamado #" + ticketId + " aberto! Aguarde, em breve um técnico vai te atender.");
        } else {
            // more messages/media arriving before a technician claims the conversation
            attachMediaIfAny(conversation.getGlpiTicketId(), msg);
            if (msg.hasText()) glpiService.addFollowup(conversation.getGlpiTicketId(), "[WhatsApp] " + msg.text());
        }
    }

    private void appendFollowupOnly(SupportConversation conversation, InboundWhatsappMessage msg) {
        if (conversation.getGlpiTicketId() == null) return;
        attachMediaIfAny(conversation.getGlpiTicketId(), msg);
        if (msg.hasText()) glpiService.addFollowup(conversation.getGlpiTicketId(), "[WhatsApp] " + msg.text());
    }

    private void attachMediaIfAny(int ticketId, InboundWhatsappMessage msg) {
        if (msg.hasMedia()) {
            glpiService.uploadDocumentToTicket(ticketId, msg.mediaBytes(), msg.mediaFilename(), msg.mediaMime());
        }
    }

    private void sendAndRecord(SupportConversation conversation, String text) {
        recordMessage(conversation, MessageDirection.OUT, MessageAuthor.HERMES, "Hermes", text);
        evolutionApiClient.sendText(conversation.getContact().getPhoneNumber(), text);
    }

    private void recordMessage(SupportConversation conversation, MessageDirection direction, MessageAuthor author,
                                String authorName, String content) {
        messageRepo.save(SupportMessage.builder()
                .conversation(conversation)
                .direction(direction)
                .author(author)
                .authorName(authorName)
                .content(content)
                .build());
    }

    private String employeeDisplayName(WhatsappContact contact, InboundWhatsappMessage msg) {
        if (contact.getGlpiUserName() != null && !contact.getGlpiUserName().isBlank()) return contact.getGlpiUserName();
        if (msg.pushName() != null && !msg.pushName().isBlank()) return msg.pushName();
        return contact.getPhoneNumber();
    }

    private String firstName(String fullName) {
        return fullName == null || fullName.isBlank() ? "" : fullName.trim().split("\\s+")[0];
    }

    private String autoTitle(String description) {
        String oneLine = description.replaceAll("\\s+", " ").trim();
        if (oneLine.isBlank()) return "Chamado via WhatsApp";
        return oneLine.length() > 70 ? oneLine.substring(0, 70) + "..." : oneLine;
    }
}
