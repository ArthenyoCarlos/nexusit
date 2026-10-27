package br.com.nexusit.support;

import br.com.nexusit.glpi.GlpiService;
import br.com.nexusit.user.Role;
import br.com.nexusit.user.User;
import br.com.nexusit.user.UserRepository;
import br.com.nexusit.whatsapp.EvolutionApiClient;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.ArgumentCaptor;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.mock.web.MockMultipartFile;

import java.util.List;
import java.util.Optional;
import java.util.UUID;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.mockito.AdditionalMatchers.aryEq;
import static org.mockito.ArgumentMatchers.*;
import static org.mockito.Mockito.*;

@ExtendWith(MockitoExtension.class)
class SupportServiceTest {

    @Mock SupportConversationRepository conversationRepo;
    @Mock SupportMessageRepository messageRepo;
    @Mock SupportConversationTechnicianRepository technicianRepo;
    @Mock UserRepository userRepo;
    @Mock GlpiService glpiService;
    @Mock EvolutionApiClient evolutionApiClient;
    @Mock BotAtendimentoTiStateStore stateStore;

    SupportService service;

    @BeforeEach
    void setUp() {
        service = new SupportService(conversationRepo, messageRepo, technicianRepo, userRepo, glpiService, evolutionApiClient, stateStore);
        lenient().when(messageRepo.save(any())).thenAnswer(inv -> inv.getArgument(0));
    }

    @Test
    void replyWithImage_sendsMediaWithBoldJobTitleSignature_andStoresAttachment() {
        UUID conversationId = UUID.randomUUID();
        WhatsappContact contact = WhatsappContact.builder()
                .id(UUID.randomUUID())
                .phoneNumber("559999999999")
                .displayName("Cliente")
                .build();
        SupportConversation conversation = SupportConversation.builder()
                .id(conversationId)
                .contact(contact)
                .state(ConversationState.HUMAN_ACTIVE)
                .glpiTicketId(123)
                .build();
        User tech = User.builder()
                .id(UUID.randomUUID())
                .name("Arthenyo Carlos")
                .email("arthenyo@example.com")
                .role(Role.ADMIN)
                .jobTitle("Consultor(a)")
                .active(true)
                .build();
        MockMultipartFile image = new MockMultipartFile("file", "print.png", "image/png", new byte[]{1, 2, 3});

        when(conversationRepo.findByIdWithContact(conversationId)).thenReturn(Optional.of(conversation));
        when(messageRepo.findByConversation(conversationId)).thenReturn(List.of());

        service.reply(conversationId, tech, "Segue evidência", image);

        verify(evolutionApiClient).sendMediaOrThrow(eq("559999999999"), aryEq(new byte[]{1, 2, 3}), eq("print.png"), eq("image/png"), eq("*Consultor(a) Arthenyo Carlos:* Segue evidência"));
        verify(glpiService).addFollowup(eq(123), contains("[Consultor(a) Arthenyo Carlos] Segue evidência"));
        verify(glpiService).uploadDocumentToTicket(eq(123), aryEq(new byte[]{1, 2, 3}), eq("print.png"), eq("image/png"));

        ArgumentCaptor<SupportMessage> saved = ArgumentCaptor.forClass(SupportMessage.class);
        verify(messageRepo).save(saved.capture());
        assertEquals("image", saved.getValue().getMediaKind());
        assertEquals("print.png", saved.getValue().getMediaFilename());
    }

    @Test
    void replyWithAudio_usesEvolutionAudioEndpoint_andStoresAttachment() {
        UUID conversationId = UUID.randomUUID();
        WhatsappContact contact = WhatsappContact.builder()
                .id(UUID.randomUUID())
                .phoneNumber("559999999999")
                .displayName("Cliente")
                .build();
        SupportConversation conversation = SupportConversation.builder()
                .id(conversationId)
                .contact(contact)
                .state(ConversationState.HUMAN_ACTIVE)
                .glpiTicketId(123)
                .build();
        User tech = User.builder()
                .id(UUID.randomUUID())
                .name("Arthenyo Carlos")
                .email("arthenyo@example.com")
                .role(Role.ADMIN)
                .jobTitle("Consultor(a)")
                .active(true)
                .build();
        byte[] audioBytes = new byte[]{9, 8, 7};
        MockMultipartFile audio = new MockMultipartFile("file", "audio.ogg", "audio/ogg", audioBytes);
        var converter = mock(WhatsappAudioConverter.class);
        byte[] converted = "OggS fixture converted by controlled seam".getBytes(java.nio.charset.StandardCharsets.UTF_8);
        when(converter.convert(audioBytes, "audio.ogg")).thenReturn(
                new WhatsappAudioConverter.Audio(converted, "audio.ogg", "audio/ogg; codecs=opus"));
        org.springframework.test.util.ReflectionTestUtils.setField(service, "audioConverter", converter);

        when(conversationRepo.findByIdWithContact(conversationId)).thenReturn(Optional.of(conversation));
        when(messageRepo.findByConversation(conversationId)).thenReturn(List.of());

        service.reply(conversationId, tech, "", audio);

        verify(converter).convert(audioBytes, "audio.ogg");
        verify(evolutionApiClient).sendWhatsAppAudioOrThrow(eq("559999999999"), aryEq(converted));
        verify(evolutionApiClient, never()).sendMediaOrThrow(anyString(), any(), anyString(), anyString(), anyString());
        verify(glpiService).uploadDocumentToTicket(eq(123), aryEq(converted), eq("audio.ogg"), eq("audio/ogg; codecs=opus"));

        ArgumentCaptor<SupportMessage> saved = ArgumentCaptor.forClass(SupportMessage.class);
        verify(messageRepo).save(saved.capture());
        assertEquals("audio", saved.getValue().getMediaKind());
        assertEquals("audio.ogg", saved.getValue().getMediaFilename());
    }
}
