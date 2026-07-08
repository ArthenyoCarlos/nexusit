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
            log.warn("Falha ao processar webhook do WhatsApp: {} — payload: {}", e.toString(), payload);
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
                media != null ? media.mime() : null
        ));
    }

    private String extractText(JsonNode messageNode) {
        if (messageNode.has("conversation")) return messageNode.path("conversation").asText("");
        if (messageNode.has("extendedTextMessage")) return messageNode.path("extendedTextMessage").path("text").asText("");
        for (String mediaType : new String[]{"imageMessage", "videoMessage", "documentMessage", "audioMessage"}) {
            if (messageNode.has(mediaType)) return messageNode.path(mediaType).path("caption").asText("");
        }
        return "";
    }

    private MediaInfo extractMedia(JsonNode messageNode) {
        for (String mediaType : new String[]{"imageMessage", "videoMessage", "documentMessage", "audioMessage"}) {
            if (!messageNode.has(mediaType)) continue;
            JsonNode m = messageNode.path(mediaType);
            String base64 = firstNonBlank(m.path("base64").asText(""), messageNode.path("base64").asText(""));
            if (base64.isBlank()) {
                log.info("Mensagem com mídia ({}) recebida sem base64 — anexo não será salvo " +
                        "(verifique se a Evolution API está com webhook_base64 habilitado)", mediaType);
                return null;
            }
            byte[] bytes = Base64.getDecoder().decode(base64);
            String mime = m.path("mimetype").asText("application/octet-stream");
            String ext = mime.contains("/") ? mime.substring(mime.indexOf('/') + 1) : "bin";
            return new MediaInfo(bytes, "anexo." + ext, mime);
        }
        return null;
    }

    private String firstNonBlank(String a, String b) { return a != null && !a.isBlank() ? a : b; }

    private record MediaInfo(byte[] bytes, String filename, String mime) {}
}
