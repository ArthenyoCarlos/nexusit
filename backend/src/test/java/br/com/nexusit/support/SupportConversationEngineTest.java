package br.com.nexusit.support;

import br.com.nexusit.glpi.GlpiService;
import br.com.nexusit.glpi.GlpiUserRef;
import br.com.nexusit.whatsapp.EvolutionApiClient;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.ArgumentCaptor;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;

import java.util.Optional;
import java.util.UUID;

import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.anyString;
import static org.mockito.ArgumentMatchers.contains;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.*;

@ExtendWith(MockitoExtension.class)
class SupportConversationEngineTest {

    @Mock WhatsappContactRepository contactRepo;
    @Mock SupportConversationRepository conversationRepo;
    @Mock SupportMessageRepository messageRepo;
    @Mock GlpiService glpiService;
    @Mock EvolutionApiClient evolutionApiClient;

    SupportConversationEngine engine;

    @BeforeEach
    void setUp() {
        engine = new SupportConversationEngine(contactRepo, conversationRepo, messageRepo, glpiService, evolutionApiClient);
        lenient().when(contactRepo.save(any())).thenAnswer(inv -> inv.getArgument(0));
        lenient().when(conversationRepo.save(any())).thenAnswer(inv -> inv.getArgument(0));
        lenient().when(messageRepo.save(any())).thenAnswer(inv -> inv.getArgument(0));
    }

    private InboundWhatsappMessage textMessage(String phone, String text) {
        return new InboundWhatsappMessage(phone, "Funcionário Teste", text, null, null, null);
    }

    @Test
    void firstContact_asksForName_andDoesNotTouchGlpiYet() {
        when(contactRepo.findByPhoneNumber("5511999999999")).thenReturn(Optional.empty());
        when(conversationRepo.findLatestOpenByContact(any())).thenReturn(Optional.empty());

        engine.onInboundMessage(textMessage("5511999999999", "oi"));

        ArgumentCaptor<String> sentText = ArgumentCaptor.forClass(String.class);
        verify(evolutionApiClient).sendText(eq("5511999999999"), sentText.capture());
        assertTrue(sentText.getValue().toLowerCase().contains("nome"));
        verifyNoInteractions(glpiService);
    }

    @Test
    void awaitingName_looksUpGlpiUser_andMovesToMenu() {
        WhatsappContact contact = WhatsappContact.builder().id(UUID.randomUUID()).phoneNumber("5511999999999").build();
        SupportConversation conversation = SupportConversation.builder()
                .id(UUID.randomUUID()).contact(contact).state(ConversationState.AWAITING_NAME).build();

        when(contactRepo.findByPhoneNumber("5511999999999")).thenReturn(Optional.of(contact));
        when(conversationRepo.findLatestOpenByContact(contact.getId())).thenReturn(Optional.of(conversation));
        when(glpiService.findUserByName("Maria Silva")).thenReturn(Optional.of(new GlpiUserRef(42, "Maria Silva")));

        engine.onInboundMessage(textMessage("5511999999999", "Maria Silva"));

        assertEquals(ConversationState.MENU, conversation.getState());
        assertEquals(42, contact.getGlpiUserId());
        verify(glpiService, never()).createUser(anyString());
        verify(evolutionApiClient).sendText(eq("5511999999999"), contains("O que você deseja"));
    }

    @Test
    void awaitingName_createsGlpiUser_whenNotFound() {
        WhatsappContact contact = WhatsappContact.builder().id(UUID.randomUUID()).phoneNumber("5511999999999").build();
        SupportConversation conversation = SupportConversation.builder()
                .id(UUID.randomUUID()).contact(contact).state(ConversationState.AWAITING_NAME).build();

        when(contactRepo.findByPhoneNumber("5511999999999")).thenReturn(Optional.of(contact));
        when(conversationRepo.findLatestOpenByContact(contact.getId())).thenReturn(Optional.of(conversation));
        when(glpiService.findUserByName("Novo Funcionario")).thenReturn(Optional.empty());
        when(glpiService.createUser("Novo Funcionario")).thenReturn(new GlpiUserRef(99, "Novo Funcionario"));

        engine.onInboundMessage(textMessage("5511999999999", "Novo Funcionario"));

        verify(glpiService).createUser("Novo Funcionario");
        assertEquals(99, contact.getGlpiUserId());
    }

    @Test
    void menu_choosingOpenTicket_movesToAwaitingDescription() {
        WhatsappContact contact = WhatsappContact.builder().id(UUID.randomUUID()).phoneNumber("5511999999999")
                .glpiUserId(42).glpiUserName("Maria Silva").build();
        SupportConversation conversation = SupportConversation.builder()
                .id(UUID.randomUUID()).contact(contact).state(ConversationState.MENU).build();

        when(contactRepo.findByPhoneNumber("5511999999999")).thenReturn(Optional.of(contact));
        when(conversationRepo.findLatestOpenByContact(contact.getId())).thenReturn(Optional.of(conversation));

        engine.onInboundMessage(textMessage("5511999999999", "1"));

        assertEquals(ConversationState.AWAITING_DESCRIPTION, conversation.getState());
    }

    @Test
    void awaitingDescription_createsTicket_andMovesToPendingTech() {
        WhatsappContact contact = WhatsappContact.builder().id(UUID.randomUUID()).phoneNumber("5511999999999")
                .glpiUserId(42).glpiUserName("Maria Silva").build();
        SupportConversation conversation = SupportConversation.builder()
                .id(UUID.randomUUID()).contact(contact).state(ConversationState.AWAITING_DESCRIPTION).build();

        when(contactRepo.findByPhoneNumber("5511999999999")).thenReturn(Optional.of(contact));
        when(conversationRepo.findLatestOpenByContact(contact.getId())).thenReturn(Optional.of(conversation));
        when(glpiService.createTicket(anyString(), anyString(), eq(42))).thenReturn(777);

        engine.onInboundMessage(textMessage("5511999999999", "Minha impressora não funciona"));

        assertEquals(ConversationState.PENDING_TECH, conversation.getState());
        assertEquals(777, conversation.getGlpiTicketId());
        verify(evolutionApiClient).sendText(eq("5511999999999"), contains("777"));
    }

    @Test
    void humanActive_neverAutoReplies_butStillLogsFollowupToGlpi() {
        WhatsappContact contact = WhatsappContact.builder().id(UUID.randomUUID()).phoneNumber("5511999999999").build();
        SupportConversation conversation = SupportConversation.builder()
                .id(UUID.randomUUID()).contact(contact).state(ConversationState.HUMAN_ACTIVE).glpiTicketId(777).build();

        when(contactRepo.findByPhoneNumber("5511999999999")).thenReturn(Optional.of(contact));
        when(conversationRepo.findLatestOpenByContact(contact.getId())).thenReturn(Optional.of(conversation));

        engine.onInboundMessage(textMessage("5511999999999", "Ainda não foi resolvido"));

        verify(evolutionApiClient, never()).sendText(anyString(), anyString());
        verify(glpiService).addFollowup(eq(777), contains("Ainda não foi resolvido"));
    }
}
