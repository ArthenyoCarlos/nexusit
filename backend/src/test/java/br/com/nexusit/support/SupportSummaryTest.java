package br.com.nexusit.support;

import br.com.nexusit.glpi.GlpiService;
import br.com.nexusit.user.*;
import br.com.nexusit.whatsapp.EvolutionApiClient;
import com.fasterxml.jackson.databind.ObjectMapper;
import org.junit.jupiter.api.Test;
import java.util.*;
import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.Mockito.*;

class SupportSummaryTest {
    @Test void everyConversationViewExposesUnreadInboundCountWithoutMarkingRead() {
        var conversations = mock(SupportConversationRepository.class);
        var messages = mock(SupportMessageRepository.class);
        var evolution = mock(EvolutionApiClient.class);
        var service = new SupportService(conversations, messages, mock(SupportConversationTechnicianRepository.class),
                mock(UserRepository.class), mock(GlpiService.class), evolution, mock(BotAtendimentoTiStateStore.class));
        var user = User.builder().id(UUID.randomUUID()).build();
        var c = SupportConversation.builder().id(UUID.randomUUID()).state(ConversationState.HUMAN_ACTIVE)
                .contact(WhatsappContact.builder().phoneNumber("fixture").build()).build();
        when(conversations.findQueue()).thenReturn(List.of(c));
        when(conversations.findMine(user.getId())).thenReturn(List.of(c));
        when(conversations.findAllSince(any())).thenReturn(List.of(c));
        when(conversations.findByIdWithContact(c.getId())).thenReturn(Optional.of(c));
        when(messages.countByConversationIdAndDirectionAndReadAtIsNull(c.getId(), MessageDirection.IN)).thenReturn(2L);
        var mapper = new ObjectMapper().findAndRegisterModules();
        for (var summary : List.of(service.getQueue().getFirst(), service.getMine(user).getFirst(),
                service.getAll(1).getFirst(), service.getDetail(c.getId()).conversation())) {
            assertEquals(2L, mapper.valueToTree(summary).path("unreadCount").asLong(-1));
        }
        verifyNoInteractions(evolution);
        verify(messages, never()).saveAll(any());
    }
}
