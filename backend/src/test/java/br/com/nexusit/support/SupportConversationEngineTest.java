package br.com.nexusit.support;

import br.com.nexusit.glpi.GlpiService;
import br.com.nexusit.glpi.GlpiTicket;
import br.com.nexusit.glpi.GlpiUserRef;
import br.com.nexusit.push.PushNotificationService;
import br.com.nexusit.whatsapp.EvolutionApiClient;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.ArgumentCaptor;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;

import java.time.LocalDateTime;
import java.util.List;
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
    @Mock SupportConversationTechnicianRepository technicianRepo;
    @Mock GlpiService glpiService;
    @Mock EvolutionApiClient evolutionApiClient;
    @Mock BotAtendimentoTiStateStore stateStore;
    @Mock AudioTranscriptionService audioTranscriptionService;
    @Mock PushNotificationService pushNotificationService;

    SupportConversationEngine engine;

    @BeforeEach
    void setUp() {
        engine = new SupportConversationEngine(contactRepo, conversationRepo, messageRepo, technicianRepo, glpiService, evolutionApiClient, stateStore, audioTranscriptionService, pushNotificationService);
        lenient().when(contactRepo.save(any())).thenAnswer(inv -> inv.getArgument(0));
        lenient().when(conversationRepo.save(any())).thenAnswer(inv -> inv.getArgument(0));
        lenient().when(messageRepo.save(any())).thenAnswer(inv -> inv.getArgument(0));
    }

    private InboundWhatsappMessage textMessage(String phone, String text) {
        return new InboundWhatsappMessage(phone, "Funcionário Teste", text, null, null, null, null);
    }

    private InboundWhatsappMessage audioMessage(String phone, byte[] bytes) {
        return new InboundWhatsappMessage(phone, "Funcionário Teste", "", bytes, "audio.ogg", "audio/ogg", "audio");
    }

    private InboundWhatsappMessage imageMessage(String phone, byte[] bytes) {
        return new InboundWhatsappMessage(phone, "Funcionário Teste", "", bytes, "foto.png", "image/png", "image");
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
        verify(evolutionApiClient).sendText(eq("5511999999999"), contains("Como posso te ajudar"));
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
    void menu_consultTickets_listsOpenTickets() {
        WhatsappContact contact = WhatsappContact.builder().id(UUID.randomUUID()).phoneNumber("5511999999999")
                .glpiUserId(42).glpiUserName("Maria Silva").build();
        SupportConversation conversation = SupportConversation.builder()
                .id(UUID.randomUUID()).contact(contact).state(ConversationState.MENU).build();

        when(contactRepo.findByPhoneNumber("5511999999999")).thenReturn(Optional.of(contact));
        when(conversationRepo.findLatestOpenByContact(contact.getId())).thenReturn(Optional.of(conversation));
        when(glpiService.getOpenTicketsForRequester(42)).thenReturn(List.of(
                new GlpiTicket(777, "Impressora parada", 1, "Novo", 3, "Média", 3, "Média", 3, "Médio", "", "Maria Silva", "", "", "", 1, "", "", "", "", 0, "MANUAL")
        ));

        engine.onInboundMessage(textMessage("5511999999999", "2"));

        verify(evolutionApiClient).sendText(eq("5511999999999"), contains("#777 - Impressora parada"));
    }

    @Test
    void menu_talkToTechnician_createsUrgentTicketAndQueuesConversation() {
        WhatsappContact contact = WhatsappContact.builder().id(UUID.randomUUID()).phoneNumber("5511999999999")
                .glpiUserId(42).glpiUserName("Maria Silva").build();
        SupportConversation conversation = SupportConversation.builder()
                .id(UUID.randomUUID()).contact(contact).state(ConversationState.MENU).build();

        when(contactRepo.findByPhoneNumber("5511999999999")).thenReturn(Optional.of(contact));
        when(conversationRepo.findLatestOpenByContact(contact.getId())).thenReturn(Optional.of(conversation));
        when(glpiService.createTicket(anyString(), anyString(), eq(42), eq(4), anyString())).thenReturn(888);

        engine.onInboundMessage(textMessage("5511999999999", "3"));

        assertEquals(ConversationState.PENDING_TECH, conversation.getState());
        assertEquals(888, conversation.getGlpiTicketId());
        verify(evolutionApiClient).sendText(eq("5511999999999"), contains("fila para um técnico assumir"));
    }

    @Test
    void menu_directProblemText_createsStructuredTicketWithoutAskingMenuAgain() {
        WhatsappContact contact = WhatsappContact.builder().id(UUID.randomUUID()).phoneNumber("5511999999999")
                .glpiUserId(42).glpiUserName("Maria Silva").build();
        SupportConversation conversation = SupportConversation.builder()
                .id(UUID.randomUUID()).contact(contact).state(ConversationState.MENU).build();

        when(contactRepo.findByPhoneNumber("5511999999999")).thenReturn(Optional.of(contact));
        when(conversationRepo.findLatestOpenByContact(contact.getId())).thenReturn(Optional.of(conversation));
        when(glpiService.createTicket(anyString(), contains("Checklist inicial sugerido"), eq(42), eq(4), eq("Rede/Internet"))).thenReturn(889);

        engine.onInboundMessage(textMessage("5511999999999", "Sem internet no setor do caixa, todos parados"));

        assertEquals(ConversationState.PENDING_TECH, conversation.getState());
        assertEquals(889, conversation.getGlpiTicketId());
        verify(evolutionApiClient).sendText(eq("5511999999999"), contains("Prioridade inicial: *Alta*"));
    }

    @Test
    void awaitingDescription_createsTicket_andMovesToPendingTech() {
        WhatsappContact contact = WhatsappContact.builder().id(UUID.randomUUID()).phoneNumber("5511999999999")
                .glpiUserId(42).glpiUserName("Maria Silva").build();
        SupportConversation conversation = SupportConversation.builder()
                .id(UUID.randomUUID()).contact(contact).state(ConversationState.AWAITING_DESCRIPTION).build();

        when(contactRepo.findByPhoneNumber("5511999999999")).thenReturn(Optional.of(contact));
        when(conversationRepo.findLatestOpenByContact(contact.getId())).thenReturn(Optional.of(conversation));
        when(glpiService.createTicket(anyString(), anyString(), eq(42), eq(3), anyString())).thenReturn(777);

        engine.onInboundMessage(textMessage("5511999999999", "Minha impressora não funciona"));

        assertEquals(ConversationState.PENDING_TECH, conversation.getState());
        assertEquals(777, conversation.getGlpiTicketId());
        verify(evolutionApiClient).sendText(eq("5511999999999"), contains("777"));
    }

    @Test
    void awaitingDescription_recordsImageMedia_andUploadsToGlpi() {
        WhatsappContact contact = WhatsappContact.builder().id(UUID.randomUUID()).phoneNumber("5511999999999")
                .glpiUserId(42).glpiUserName("Maria Silva").build();
        SupportConversation conversation = SupportConversation.builder()
                .id(UUID.randomUUID()).contact(contact).state(ConversationState.AWAITING_DESCRIPTION).build();
        byte[] bytes = new byte[]{1, 2, 3};

        when(contactRepo.findByPhoneNumber("5511999999999")).thenReturn(Optional.of(contact));
        when(conversationRepo.findLatestOpenByContact(contact.getId())).thenReturn(Optional.of(conversation));
        when(glpiService.createTicket(anyString(), anyString(), eq(42), eq(3), anyString())).thenReturn(777);

        engine.onInboundMessage(imageMessage("5511999999999", bytes));

        ArgumentCaptor<SupportMessage> saved = ArgumentCaptor.forClass(SupportMessage.class);
        verify(messageRepo, atLeastOnce()).save(saved.capture());
        SupportMessage inbound = saved.getAllValues().stream()
                .filter(m -> m.getDirection() == MessageDirection.IN)
                .findFirst().orElseThrow();
        assertArrayEquals(bytes, inbound.getMediaBytes());
        assertEquals("foto.png", inbound.getMediaFilename());
        assertEquals("image/png", inbound.getMediaMime());
        assertEquals("image", inbound.getMediaKind());
        verify(glpiService).uploadDocumentToTicket(eq(777), eq(bytes), eq("foto.png"), eq("image/png"));
    }

    @Test
    void awaitingDescription_transcribesAudio_andUsesTranscriptInTicket() {
        WhatsappContact contact = WhatsappContact.builder().id(UUID.randomUUID()).phoneNumber("5511999999999")
                .glpiUserId(42).glpiUserName("Maria Silva").build();
        SupportConversation conversation = SupportConversation.builder()
                .id(UUID.randomUUID()).contact(contact).state(ConversationState.AWAITING_DESCRIPTION).build();
        byte[] bytes = new byte[]{9, 8, 7};

        when(contactRepo.findByPhoneNumber("5511999999999")).thenReturn(Optional.of(contact));
        when(conversationRepo.findLatestOpenByContact(contact.getId())).thenReturn(Optional.of(conversation));
        when(audioTranscriptionService.transcribe(bytes, "audio.ogg", "audio/ogg"))
                .thenReturn("A impressora do caixa três parou de imprimir.");
        when(glpiService.createTicket(anyString(), contains("A impressora do caixa três"), eq(42), eq(3), anyString())).thenReturn(778);

        engine.onInboundMessage(audioMessage("5511999999999", bytes));

        assertEquals(778, conversation.getGlpiTicketId());
        ArgumentCaptor<SupportMessage> saved = ArgumentCaptor.forClass(SupportMessage.class);
        verify(messageRepo, atLeastOnce()).save(saved.capture());
        SupportMessage inbound = saved.getAllValues().stream()
                .filter(m -> m.getDirection() == MessageDirection.IN)
                .findFirst().orElseThrow();
        assertEquals("audio", inbound.getMediaKind());
        assertEquals("A impressora do caixa três parou de imprimir.", inbound.getTranscription());
        assertTrue(inbound.getContent().contains("Áudio transcrito"));
    }

    @Test
    void menuExpired_closesOldConversation_startsFreshMenu_andDoesNotProcessStaleOption() {
        WhatsappContact contact = WhatsappContact.builder().id(UUID.randomUUID()).phoneNumber("5511999999999")
                .glpiUserId(42).glpiUserName("Maria Silva").build();
        SupportConversation conversation = SupportConversation.builder()
                .id(UUID.randomUUID()).contact(contact).state(ConversationState.MENU)
                .createdAt(LocalDateTime.now().minusHours(2)).build();
        SupportMessage lastMessage = SupportMessage.builder()
                .conversation(conversation).direction(MessageDirection.OUT).author(MessageAuthor.HERMES)
                .content("menu").createdAt(LocalDateTime.now().minusMinutes(61)).build();

        when(contactRepo.findByPhoneNumber("5511999999999")).thenReturn(Optional.of(contact));
        when(conversationRepo.findLatestOpenByContact(contact.getId())).thenReturn(Optional.of(conversation));
        when(messageRepo.findFirstByConversationIdOrderByCreatedAtDesc(conversation.getId())).thenReturn(Optional.of(lastMessage));

        engine.onInboundMessage(textMessage("5511999999999", "1"));

        assertEquals(ConversationState.CLOSED, conversation.getState());
        assertNotNull(conversation.getClosedAt());
        verify(glpiService, never()).createTicket(anyString(), anyString(), anyInt(), anyInt(), anyString());
        verify(evolutionApiClient).sendText(eq("5511999999999"), contains("expirou por inatividade"));
        verify(evolutionApiClient).sendText(eq("5511999999999"), contains("Como posso te ajudar"));
    }

    @Test
    void awaitingDescriptionExpired_restartsMenuWithoutOpeningTicketFromLateText() {
        WhatsappContact contact = WhatsappContact.builder().id(UUID.randomUUID()).phoneNumber("5511999999999")
                .glpiUserId(42).glpiUserName("Maria Silva").build();
        SupportConversation conversation = SupportConversation.builder()
                .id(UUID.randomUUID()).contact(contact).state(ConversationState.AWAITING_DESCRIPTION)
                .createdAt(LocalDateTime.now().minusHours(3)).build();
        SupportMessage lastMessage = SupportMessage.builder()
                .conversation(conversation).direction(MessageDirection.OUT).author(MessageAuthor.HERMES)
                .content("descreva").createdAt(LocalDateTime.now().minusHours(3)).build();

        when(contactRepo.findByPhoneNumber("5511999999999")).thenReturn(Optional.of(contact));
        when(conversationRepo.findLatestOpenByContact(contact.getId())).thenReturn(Optional.of(conversation));
        when(messageRepo.findFirstByConversationIdOrderByCreatedAtDesc(conversation.getId())).thenReturn(Optional.of(lastMessage));

        engine.onInboundMessage(textMessage("5511999999999", "A impressora parou"));

        assertEquals(ConversationState.CLOSED, conversation.getState());
        verify(glpiService, never()).createTicket(anyString(), anyString(), anyInt(), anyInt(), anyString());
        verify(evolutionApiClient).sendText(eq("5511999999999"), contains("expirou por inatividade"));
        verify(evolutionApiClient).sendText(eq("5511999999999"), contains("Como posso te ajudar"));
    }

    @Test
    void humanActiveWithinTimeout_remainsSilentAndLogsFollowup() {
        WhatsappContact contact = WhatsappContact.builder().id(UUID.randomUUID()).phoneNumber("5511999999999").build();
        SupportConversation conversation = SupportConversation.builder()
                .id(UUID.randomUUID()).contact(contact).state(ConversationState.HUMAN_ACTIVE).glpiTicketId(777)
                .createdAt(LocalDateTime.now().minusDays(2)).build();
        SupportMessage lastMessage = SupportMessage.builder()
                .conversation(conversation).direction(MessageDirection.IN).author(MessageAuthor.EMPLOYEE)
                .content("mensagem anterior").createdAt(LocalDateTime.now().minusDays(2)).build();

        when(contactRepo.findByPhoneNumber("5511999999999")).thenReturn(Optional.of(contact));
        when(conversationRepo.findLatestOpenByContact(contact.getId())).thenReturn(Optional.of(conversation));
        when(messageRepo.findFirstByConversationIdOrderByCreatedAtDesc(conversation.getId())).thenReturn(Optional.of(lastMessage));

        engine.onInboundMessage(textMessage("5511999999999", "Ainda preciso de ajuda"));

        assertEquals(ConversationState.HUMAN_ACTIVE, conversation.getState());
        verify(evolutionApiClient, never()).sendText(anyString(), anyString());
        verify(glpiService).addFollowup(eq(777), contains("Ainda preciso de ajuda"));
    }
}
