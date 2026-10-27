package br.com.nexusit.support;

import br.com.nexusit.glpi.GlpiService;
import br.com.nexusit.user.*;
import br.com.nexusit.whatsapp.EvolutionApiClient;
import org.junit.jupiter.api.Test;
import java.time.LocalDateTime;
import java.util.*;
import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.Mockito.*;

class SupportReadTest {
    final SupportConversationRepository conversations = mock(SupportConversationRepository.class);
    final SupportMessageRepository messages = mock(SupportMessageRepository.class);
    final SupportConversationTechnicianRepository technicians = mock(SupportConversationTechnicianRepository.class);
    final EvolutionApiClient evolution = mock(EvolutionApiClient.class);
    final SupportService service = new SupportService(conversations, messages, technicians,
            mock(UserRepository.class), mock(GlpiService.class), evolution, mock(BotAtendimentoTiStateStore.class));
    final UUID id = UUID.randomUUID();
    final SupportConversation conversation = SupportConversation.builder().id(id).build();
    final User user = User.builder().id(UUID.randomUUID()).role(Role.ADMIN).build();
    SupportMessage incoming() {
        return SupportMessage.builder().id(UUID.randomUUID()).conversation(conversation).direction(MessageDirection.IN)
                .createdAt(LocalDateTime.now()).build();
    }
    void setup(List<SupportMessage> list) {
        when(conversations.findByIdWithContact(id)).thenReturn(Optional.of(conversation));
        when(messages.findByConversation(id)).thenReturn(list);
    }
    @Test void onlyDisplayedInboundMessagesAreMarkedAndRepeatedReadsAreIdempotent() {
        var first = incoming(); var future = incoming(); setup(List.of(first, future));
        var result = service.markRead(id, user, first.getId());
        assertNotNull(first.getReadAt()); assertNull(future.getReadAt());
        assertEquals(1, result.unreadCount()); assertEquals("UNAVAILABLE", result.remoteRead());
        var readAt = first.getReadAt(); service.markRead(id, user, first.getId());
        assertEquals(readAt, first.getReadAt()); verifyNoInteractions(evolution);
    }
    @Test void confirmedReadIsNotSentAgain() {
        var m = incoming(); m.setProviderMessageId("key"); m.setRemoteJid("fixture@s.whatsapp.net"); m.setFromMe(false);
        setup(List.of(m)); when(evolution.markMessagesRead(anyList())).thenReturn(true);
        assertEquals("CONFIRMED", service.markRead(id, user, m.getId()).remoteRead());
        assertNotNull(m.getRemoteReadAt()); assertFalse(m.isRemoteReadPending());
        service.markRead(id, user, m.getId()); verify(evolution, times(1)).markMessagesRead(anyList());
    }
    @Test void networkFailureKeepsLocalReadAndRetriesOnNextExplicitRead() {
        var m = incoming(); m.setProviderMessageId("key"); m.setRemoteJid("fixture@s.whatsapp.net"); m.setFromMe(false);
        setup(List.of(m)); when(evolution.markMessagesRead(anyList())).thenThrow(new RuntimeException("fixture network"));
        assertEquals("PENDING", service.markRead(id, user, m.getId()).remoteRead());
        assertNotNull(m.getReadAt()); assertTrue(m.isRemoteReadPending()); assertNull(m.getRemoteReadAt());
        doReturn(true).when(evolution).markMessagesRead(anyList());
        assertEquals("CONFIRMED", service.markRead(id, user, m.getId()).remoteRead());
    }
    @Test void messageResponseExposesLocalReadTime() throws Exception {
        var m = incoming(); m.setAuthor(MessageAuthor.EMPLOYEE); m.setReadAt(LocalDateTime.now());
        var response = SupportMessageResponse.from(m);
        assertEquals(m.getReadAt(), response.getClass().getMethod("readAt").invoke(response));
    }
    @Test void absentCursorDoesNotMarkHiddenMessages() {
        var m = incoming(); setup(List.of(m)); service.markRead(id, user, null);
        assertNull(m.getReadAt()); verifyNoInteractions(evolution);
    }
    @Test void cursorFromAnotherConversationIsRejected() {
        setup(List.of(incoming()));
        assertThrows(org.springframework.web.server.ResponseStatusException.class, () -> service.markRead(id, user, UUID.randomUUID()));
        verifyNoInteractions(evolution);
    }
    @Test void unrelatedTechnicianCannotMarkAssignedConversationRead() {
        conversation.setClaimedBy(User.builder().id(UUID.randomUUID()).build());
        when(conversations.findByIdWithContact(id)).thenReturn(Optional.of(conversation));
        var other = User.builder().id(UUID.randomUUID()).role(Role.TECHNICIAN).build();
        assertThrows(org.springframework.web.server.ResponseStatusException.class, () -> service.markRead(id, other, UUID.randomUUID()));
        verifyNoInteractions(messages, evolution);
    }
}
