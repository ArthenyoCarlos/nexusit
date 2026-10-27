package br.com.nexusit.whatsapp;

import br.com.nexusit.support.InboundWhatsappMessage;
import br.com.nexusit.support.SupportConversationEngine;
import com.fasterxml.jackson.databind.JsonNode;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.util.Base64;
import java.util.Locale;

/**
 * Receives Evolution API's "messages.upsert" webhook events. This endpoint has no
 * NexusIT user to authenticate as, so it's protected by a shared-secret token
 * instead of JWT (configured on both sides via application.whatsapp.webhook-token).
 */
@RestController
@RequestMapping("/api/whatsapp")
@RequiredArgsConstructor
@Slf4j
public class WhatsappWebhookController {

    private final EvolutionApiProperties props;
    private final SupportConversationEngine engine;

    @PostMapping("/webhook")
    public ResponseEntity<Void> receive(
            @RequestBody JsonNode payload,
            @RequestParam(required = false) String token,
            @RequestHeader(value = "X-Webhook-Token", required = false) String headerToken) {

        String expected = props.getWebhookToken();
        if (!expected.isBlank() && !expected.equals(token) && !expected.equals(headerToken)) {
            return ResponseEntity.status(HttpStatus.UNAUTHORIZED).build();
        }

        try {
            processPayload(payload);
        } catch (Exception e) {
            log.warn("Falha ao processar webhook do WhatsApp ({})", e.getClass().getSimpleName());
        }
        return ResponseEntity.ok().build();
    }

    private void processPayload(JsonNode payload) {
        String event = payload.path("event").asText("");
        if (!"messages.upsert".equals(event)) return;

        JsonNode data = payload.path("data");
        // Some Evolution API versions nest one extra level under data.message
        JsonNode envelope = data.has("key") ? data : data.path("message");
        JsonNode key = envelope.path("key");

        if (key.path("fromMe").asBoolean(false)) return; // ignore echoes of messages we sent

        String remoteJid = key.path("remoteJid").asText("");
        String remoteJidAlt = key.path("remoteJidAlt").asText("");
        String contactJid = remoteJid.endsWith("@lid") && !remoteJidAlt.isBlank() ? remoteJidAlt : remoteJid;
        if (contactJid.isBlank() || contactJid.endsWith("@g.us")) return; // ignore group chats

        String phoneNumber = contactJid.split("@")[0];
        String pushName = firstNonBlank(envelope.path("pushName").asText(""), data.path("pushName").asText(""));

        JsonNode messageNode = envelope.path("message");
        String text = extractText(messageNode);
        MediaInfo media = extractMedia(messageNode);

        engine.onInboundMessage(new InboundWhatsappMessage(
                phoneNumber, pushName, text,
                media != null ? media.bytes() : null,
                media != null ? media.filename() : null,
                media != null ? media.mime() : null,
                media != null ? media.kind() : null,
                key.path("id").asText(null), remoteJid, false
        ));
    }

    private String extractText(JsonNode messageNode) {
        if (messageNode.has("conversation")) return messageNode.path("conversation").asText("");
        if (messageNode.has("extendedTextMessage")) return messageNode.path("extendedTextMessage").path("text").asText("");
        for (String mediaType : mediaTypes()) {
            if (messageNode.has(mediaType)) return messageNode.path(mediaType).path("caption").asText("");
        }
        return "";
    }

    private MediaInfo extractMedia(JsonNode messageNode) {
        for (String mediaType : mediaTypes()) {
            if (!messageNode.has(mediaType)) continue;
            JsonNode m = messageNode.path(mediaType);
            String base64 = firstNonBlank(m.path("base64").asText(""), messageNode.path("base64").asText(""));
            if (base64.isBlank()) {
                log.info("Mensagem com mídia ({}) recebida sem base64 — anexo não será salvo " +
                        "(verifique se a Evolution API está com webhook_base64 habilitado)", mediaType);
                return null;
            }
            byte[] bytes = Base64.getDecoder().decode(base64);
            String mime = firstNonBlank(m.path("mimetype").asText(""), defaultMime(mediaType));
            String filename = firstNonBlank(m.path("fileName").asText(""), "whatsapp-" + kind(mediaType) + "." + extensionFor(mime, mediaType));
            return new MediaInfo(bytes, filename, mime, kind(mediaType));
        }
        return null;
    }

    private String[] mediaTypes() {
        return new String[]{"imageMessage", "videoMessage", "documentMessage", "audioMessage", "stickerMessage"};
    }

    private String kind(String mediaType) {
        return switch (mediaType) {
            case "imageMessage" -> "image";
            case "videoMessage" -> "video";
            case "audioMessage" -> "audio";
            case "stickerMessage" -> "sticker";
            default -> "document";
        };
    }

    private String defaultMime(String mediaType) {
        return switch (mediaType) {
            case "imageMessage" -> "image/jpeg";
            case "videoMessage" -> "video/mp4";
            case "audioMessage" -> "audio/ogg";
            case "stickerMessage" -> "image/webp";
            default -> "application/octet-stream";
        };
    }

    private String extensionFor(String mime, String mediaType) {
        String normalized = mime == null ? "" : mime.toLowerCase(Locale.ROOT);
        if (normalized.contains("webp")) return "webp";
        if (normalized.contains("jpeg")) return "jpg";
        if (normalized.contains("png")) return "png";
        if (normalized.contains("mp4")) return "mp4";
        if (normalized.contains("quicktime")) return "mov";
        if (normalized.contains("ogg") || normalized.contains("opus")) return "ogg";
        if (normalized.contains("mpeg")) return "mp3";
        if (normalized.contains("wav")) return "wav";
        if (normalized.contains("pdf")) return "pdf";
        if (mime != null && mime.contains("/")) {
            String ext = mime.substring(mime.indexOf('/') + 1).split("[;+]")[0].replaceAll("[^a-z0-9]", "");
            if (!ext.isBlank()) return ext;
        }
        return switch (mediaType) {
            case "stickerMessage" -> "webp";
            case "audioMessage" -> "ogg";
            case "videoMessage" -> "mp4";
            case "imageMessage" -> "jpg";
            default -> "bin";
        };
    }

    private String firstNonBlank(String a, String b) { return a != null && !a.isBlank() ? a : b; }

    private record MediaInfo(byte[] bytes, String filename, String mime, String kind) {}
}
