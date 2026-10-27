package br.com.nexusit.support;

import br.com.nexusit.glpi.GlpiService;
import br.com.nexusit.user.*;
import br.com.nexusit.whatsapp.EvolutionApiClient;
import org.junit.jupiter.api.Test;
import org.springframework.mock.web.MockMultipartFile;
import org.springframework.web.server.ResponseStatusException;
import java.util.*;
import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.Mockito.*;

class SupportDeliveryTest {
    final SupportConversationRepository conversations = mock(SupportConversationRepository.class);
    final SupportMessageRepository messages = mock(SupportMessageRepository.class);
    final GlpiService glpi = mock(GlpiService.class);
    final EvolutionApiClient evolution = mock(EvolutionApiClient.class);
    final SupportService service = new SupportService(conversations, messages, mock(SupportConversationTechnicianRepository.class),
            mock(UserRepository.class), glpi, evolution, mock(BotAtendimentoTiStateStore.class));
    final UUID id = UUID.randomUUID();
    final User user = User.builder().id(UUID.randomUUID()).name("Fixture").role(Role.ADMIN).build();
    void setup() {
        var c = SupportConversation.builder().id(id).contact(WhatsappContact.builder().phoneNumber("fixture").build())
                .state(ConversationState.HUMAN_ACTIVE).glpiTicketId(1).build();
        when(conversations.findByIdWithContact(id)).thenReturn(Optional.of(c));
    }
    @Test void upstreamFailureDoesNotCreateFictionalOutboundMessage() {
        setup(); doThrow(new RuntimeException("upstream rejected")).when(evolution).sendTextOrThrow(anyString(), anyString());
        assertThrows(RuntimeException.class, () -> service.reply(id, user, "fixture"));
        verify(messages, never()).save(any()); verifyNoInteractions(glpi);
    }
    @Test void persistenceHappensAfterAcknowledgementAndGlpiFailureDoesNotMisreportSend() {
        setup(); doThrow(new RuntimeException("fixture GLPI")).when(glpi).addFollowup(anyInt(), anyString());
        assertDoesNotThrow(() -> service.reply(id, user, "fixture"));
        var ordered = inOrder(evolution, messages);
        ordered.verify(evolution).sendTextOrThrow(anyString(), anyString()); ordered.verify(messages).save(any());
    }
    @Test void audioWithTextIsRejectedBeforeConversionOrAnySend() {
        setup();
        var error = assertThrows(ResponseStatusException.class, () -> service.reply(id, user, "Não descartar",
                new MockMultipartFile("file", "audio.ogg", "audio/ogg", new byte[]{9, 8, 7})));
        assertEquals(400, error.getStatusCode().value());
        assertTrue(error.getReason().contains("separadamente"));
        verifyNoInteractions(evolution); verify(messages, never()).save(any());
    }
    @Test void invalidAudioNeverFallsBackToSendingOriginalBytes() {
        setup();
        assertThrows(ResponseStatusException.class, () -> service.reply(id, user, "",
                new MockMultipartFile("file", "invalid.ogg", "audio/ogg", new byte[]{9, 8, 7})));
        verifyNoInteractions(evolution); verify(messages, never()).save(any());
    }
    @Test void oversizedInputIsRejectedBeforeConversionOrSending() {
        setup();
        assertThrows(ResponseStatusException.class, () -> service.reply(id, user, "",
                new MockMultipartFile("file", "large.webm", "audio/webm", new byte[32*1024*1024+1])));
        verifyNoInteractions(evolution); verify(messages, never()).save(any());
    }
}
