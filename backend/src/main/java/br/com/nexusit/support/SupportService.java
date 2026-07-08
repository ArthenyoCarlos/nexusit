package br.com.nexusit.support;

import br.com.nexusit.glpi.GlpiService;
import br.com.nexusit.user.Role;
import br.com.nexusit.user.User;
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
import java.nio.file.Files;
import java.nio.file.Path;
import java.time.LocalDateTime;
import java.util.List;
import java.util.Locale;
import java.util.UUID;

@Service
@RequiredArgsConstructor
@Slf4j
@Transactional(readOnly = true)
public class SupportService {

    private final SupportConversationRepository conversationRepo;
    private final SupportMessageRepository messageRepo;
    private final GlpiService glpiService;
    private final EvolutionApiClient evolutionApiClient;
    private final BotAtendimentoTiStateStore stateStore;

    public List<SupportConversationSummary> getQueue() {
        return conversationRepo.findQueue().stream().map(SupportConversationSummary::from).toList();
    }

    public List<SupportConversationSummary> getMine(User user) {
        return conversationRepo.findMine(user.getId()).stream().map(SupportConversationSummary::from).toList();
    }

    public SupportConversationDetail getDetail(UUID id) {
        SupportConversation conversation = getOrThrow(id);
        List<SupportMessageResponse> messages = messageRepo.findByConversation(id).stream()
                .map(SupportMessageResponse::from).toList();
        return new SupportConversationDetail(SupportConversationSummary.from(conversation), messages);
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
        }
        return getDetail(id);
    }

    @Transactional
    public SupportConversationDetail reply(UUID id, User user, String message) {
        return reply(id, user, message, null);
    }

    @Transactional
    public SupportConversationDetail reply(UUID id, User user, String message, MultipartFile file) {
        SupportConversation conversation = getOrThrow(id);
        if (conversation.getState() != ConversationState.HUMAN_ACTIVE) {
            throw new ResponseStatusException(HttpStatus.CONFLICT, "Este atendimento não está mais ativo");
        }

        String cleanMessage = message == null ? "" : message.trim();
        byte[] bytes = null;
        String filename = null;
        String mime = null;
        String kind = null;
        if (file != null && !file.isEmpty()) {
            try {
                bytes = file.getBytes();
            } catch (IOException e) {
                throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Não foi possível ler o anexo");
            }
            filename = safeFilename(file.getOriginalFilename(), file.getContentType());
            mime = file.getContentType() == null || file.getContentType().isBlank() ? "application/octet-stream" : file.getContentType();
            kind = mediaKind(mime);
            if ("audio".equals(kind)) {
                OutgoingMedia converted = convertAudioForWhatsapp(bytes, filename, mime);
                bytes = converted.bytes();
                filename = converted.filename();
                mime = converted.mime();
                kind = mediaKind(mime);
            }
        }
        if (cleanMessage.isBlank() && (bytes == null || bytes.length == 0)) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Informe uma mensagem ou anexe uma mídia");
        }

        recordMessage(conversation, MessageDirection.OUT, MessageAuthor.TECH, user.getName(), cleanMessage, bytes, filename, mime, kind, null);

        String signedText = signedMessage(user, cleanMessage);
        if (bytes != null && bytes.length > 0) {
            // Áudio geralmente não mostra caption no WhatsApp; quando houver texto junto, envie o texto antes.
            if ("audio".equals(kind) && !cleanMessage.isBlank()) {
                evolutionApiClient.sendText(conversation.getContact().getPhoneNumber(), signedText);
                evolutionApiClient.sendMedia(conversation.getContact().getPhoneNumber(), bytes, filename, mime, "");
            } else {
                evolutionApiClient.sendMedia(conversation.getContact().getPhoneNumber(), bytes, filename, mime, cleanMessage.isBlank() ? signedHeader(user) : signedText);
            }
        } else {
            evolutionApiClient.sendText(conversation.getContact().getPhoneNumber(), signedText);
        }

        if (conversation.getGlpiTicketId() != null) {
            String followup = "[" + supportTitle(user) + " " + user.getName() + "]" + (cleanMessage.isBlank() ? " Enviou anexo." : " " + cleanMessage);
            glpiService.addFollowup(conversation.getGlpiTicketId(), followup);
            if (bytes != null && bytes.length > 0) {
                glpiService.uploadDocumentToTicket(conversation.getGlpiTicketId(), bytes, filename, mime);
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

    private String mediaKind(String mime) {
        String m = mime == null ? "" : mime.toLowerCase(Locale.ROOT);
        if (m.startsWith("image/")) return "image";
        if (m.startsWith("video/")) return "video";
        if (m.startsWith("audio/")) return "audio";
        return "document";
    }

    private OutgoingMedia convertAudioForWhatsapp(byte[] input, String filename, String mime) {
        String normalizedMime = mime == null ? "" : mime.toLowerCase(Locale.ROOT);
        boolean alreadyWhatsappFriendly = normalizedMime.startsWith("audio/ogg") || normalizedMime.startsWith("audio/mpeg") || normalizedMime.startsWith("audio/mp4");
        if (alreadyWhatsappFriendly) {
            return new OutgoingMedia(input, filename, mime);
        }

        Path in = null;
        Path out = null;
        try {
            in = Files.createTempFile("nexusit-audio-in-", extensionFor(filename, mime));
            out = Files.createTempFile("nexusit-audio-out-", ".ogg");
            Files.write(in, input);
            Process process = new ProcessBuilder(
                    "ffmpeg", "-y", "-hide_banner", "-loglevel", "error",
                    "-i", in.toString(),
                    "-vn", "-c:a", "libopus", "-b:a", "32k", "-ar", "48000", "-ac", "1",
                    out.toString()
            ).redirectErrorStream(true).start();
            byte[] output = process.getInputStream().readAllBytes();
            boolean finished = process.waitFor(20, java.util.concurrent.TimeUnit.SECONDS);
            if (!finished) {
                process.destroyForcibly();
                throw new IOException("timeout ao converter áudio");
            }
            if (process.exitValue() != 0) {
                throw new IOException("ffmpeg exit=" + process.exitValue() + " output=" + new String(output));
            }
            byte[] converted = Files.readAllBytes(out);
            String outName = baseName(filename == null || filename.isBlank() ? "audio-tecnico" : filename) + ".ogg";
            return new OutgoingMedia(converted, outName, "audio/ogg; codecs=opus");
        } catch (Exception e) {
            log.warn("Falha ao converter áudio '{}' de {} para OGG/Opus; enviando original: {}", filename, mime, e.toString());
            return new OutgoingMedia(input, filename, mime);
        } finally {
            deleteQuietly(in);
            deleteQuietly(out);
        }
    }

    private String extensionFor(String filename, String mime) {
        if (filename != null && filename.contains(".")) {
            return filename.substring(filename.lastIndexOf('.'));
        }
        String m = mime == null ? "" : mime.toLowerCase(Locale.ROOT);
        if (m.contains("webm")) return ".webm";
        if (m.contains("ogg")) return ".ogg";
        if (m.contains("mpeg") || m.contains("mp3")) return ".mp3";
        return ".audio";
    }

    private String baseName(String filename) {
        String clean = filename.replaceAll("[\\r\\n\\t]", "_");
        int dot = clean.lastIndexOf('.');
        return dot > 0 ? clean.substring(0, dot) : clean;
    }

    private void deleteQuietly(Path path) {
        if (path == null) return;
        try { Files.deleteIfExists(path); } catch (IOException ignored) { }
    }

    private record OutgoingMedia(byte[] bytes, String filename, String mime) {}

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
