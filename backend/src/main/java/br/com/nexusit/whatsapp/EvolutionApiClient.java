package br.com.nexusit.whatsapp;

import lombok.extern.slf4j.Slf4j;
import org.springframework.http.HttpEntity;
import org.springframework.http.HttpHeaders;
import org.springframework.http.HttpMethod;
import org.springframework.http.MediaType;
import org.springframework.http.client.SimpleClientHttpRequestFactory;
import org.springframework.stereotype.Service;
import org.springframework.web.client.RestTemplate;

import javax.net.ssl.HostnameVerifier;
import javax.net.ssl.HttpsURLConnection;
import javax.net.ssl.SSLContext;
import javax.net.ssl.TrustManager;
import javax.net.ssl.X509TrustManager;
import java.io.IOException;
import java.net.HttpURLConnection;
import java.security.SecureRandom;
import java.security.cert.X509Certificate;
import java.util.Base64;
import java.util.LinkedHashMap;
import java.util.Locale;
import java.util.Map;

/** Thin HTTP client for the Evolution API (WhatsApp gateway) send-message endpoint. */
@Service
@Slf4j
public class EvolutionApiClient {

    private final EvolutionApiProperties props;
    private final RestTemplate restTemplate;
    private final RestTemplate mediaRestTemplate;

    public EvolutionApiClient(EvolutionApiProperties props) {
        this.props = props;
        var factory = createRequestFactory();
        factory.setConnectTimeout(5000);
        factory.setReadTimeout(10000);
        this.restTemplate = new RestTemplate(factory);
        var mediaFactory = createRequestFactory();
        mediaFactory.setConnectTimeout(5000);
        mediaFactory.setReadTimeout(120000);
        this.mediaRestTemplate = new RestTemplate(mediaFactory);
    }

    /** Only an explicit Evolution acknowledgement constitutes a remote read. Safe to retry. */
    public boolean markMessagesRead(java.util.List<Map<String, Object>> keys) {
        if (!props.isConfigured() || keys.isEmpty()) return false;
        HttpHeaders headers = new HttpHeaders();
        headers.setContentType(MediaType.APPLICATION_JSON);
        headers.set("apikey", props.getApiKey());
        var response = restTemplate.exchange(props.getBaseUrl() + "/chat/markMessageAsRead/" + props.getInstanceName(),
                HttpMethod.POST, new HttpEntity<>(Map.of("readMessages", keys), headers), Map.class);
        return response.getBody() != null && "success".equals(response.getBody().get("read"));
    }

    /** Best-effort: logs and returns without throwing if not configured or if the call fails. */
    public void sendText(String phoneNumber, String text) {
        if (!props.isConfigured()) {
            log.warn("Evolution API não configurada — mensagem para {} não enviada", phoneNumber);
            return;
        }
        try {
            HttpHeaders headers = new HttpHeaders();
            headers.setContentType(MediaType.APPLICATION_JSON);
            headers.set("apikey", props.getApiKey());
            Map<String, Object> body = Map.of("number", phoneNumber, "text", text);
            restTemplate.exchange(
                    props.getBaseUrl() + "/message/sendText/" + props.getInstanceName(),
                    HttpMethod.POST, new HttpEntity<>(body, headers), Map.class);
        } catch (Exception e) {
            log.warn("Falha ao enviar mensagem WhatsApp para {}: {}", phoneNumber, e.toString());
        }
    }

    /**
     * Same as {@link #sendText}, but rethrows on failure instead of swallowing it. For
     * user-triggered sends (e.g. the Broadcast page) where the operator needs to know
     * whether the message actually went out — unlike Hermes's fire-and-forget replies.
     */
    public void sendTextOrThrow(String target, String text) {
        sendAcknowledged(restTemplate, "/message/sendText/", Map.of("number", target, "text", text));
    }

    public void sendWhatsAppAudioOrThrow(String target, byte[] bytes) {
        sendAcknowledged(mediaRestTemplate, "/message/sendWhatsAppAudio/", Map.of(
                "number", target, "audio", Base64.getEncoder().encodeToString(bytes)));
    }

    public void sendMediaOrThrow(String target, byte[] bytes, String filename, String mime, String caption) {
        String normalized = normalizeMime(mime);
        sendAcknowledged(mediaRestTemplate, "/message/sendMedia/", Map.of(
                "number", target, "mediatype", mediaType(normalized), "mimetype", normalized,
                "caption", caption == null ? "" : caption, "fileName", filename == null ? defaultFilename(normalized) : filename,
                "media", Base64.getEncoder().encodeToString(bytes)));
    }

    private void sendAcknowledged(RestTemplate client, String endpoint, Map<String, Object> body) {
        if (!props.isConfigured()) throw new org.springframework.web.server.ResponseStatusException(
                org.springframework.http.HttpStatus.SERVICE_UNAVAILABLE, "Evolution API não configurada; nada foi enviado");
        HttpHeaders headers = new HttpHeaders();
        headers.setContentType(MediaType.APPLICATION_JSON);
        headers.set("apikey", props.getApiKey());
        try {
            var response = client.exchange(props.getBaseUrl() + endpoint + props.getInstanceName(),
                    HttpMethod.POST, new HttpEntity<>(body, headers), Map.class);
            if (response.getBody() == null || !(response.getBody().get("key") instanceof Map<?, ?> key)
                    || !(key.get("id") instanceof String id) || id.isBlank()) {
                throw new org.springframework.web.server.ResponseStatusException(org.springframework.http.HttpStatus.BAD_GATEWAY,
                        "Confirmação do WhatsApp incerta (sem ACK); confira antes de reenviar");
            }
        } catch (org.springframework.web.client.ResourceAccessException e) {
            throw new org.springframework.web.server.ResponseStatusException(org.springframework.http.HttpStatus.GATEWAY_TIMEOUT,
                    "Confirmação do WhatsApp incerta por falha de conexão/tempo limite; confira antes de reenviar");
        } catch (org.springframework.web.client.RestClientResponseException e) {
            throw new org.springframework.web.server.ResponseStatusException(org.springframework.http.HttpStatus.BAD_GATEWAY,
                    e.getStatusCode().is4xxClientError() ? "Envio rejeitado pelo WhatsApp (HTTP " + e.getStatusCode().value() + ")"
                    : "WhatsApp retornou erro; confirmação incerta, confira antes de reenviar");
        }
    }

    /** Best-effort media send through Evolution API v2 sendMedia endpoint. */
    public void sendMedia(String phoneNumber, byte[] bytes, String filename, String mime, String caption) {
        if (!props.isConfigured()) {
            log.warn("Evolution API não configurada — mídia para {} não enviada", phoneNumber);
            return;
        }
        if (bytes == null || bytes.length == 0) return;
        try {
            HttpHeaders headers = new HttpHeaders();
            headers.setContentType(MediaType.APPLICATION_JSON);
            headers.set("apikey", props.getApiKey());
            String safeMime = normalizeMime(mime);
            String safeFilename = filename == null || filename.isBlank() ? defaultFilename(safeMime) : filename;
            String mediatype = mediaType(safeMime);
            Map<String, Object> body = new LinkedHashMap<>();
            body.put("number", phoneNumber);
            body.put("mediatype", mediatype);
            body.put("mimetype", safeMime);
            body.put("caption", caption == null ? "" : caption);
            body.put("media", Base64.getEncoder().encodeToString(bytes));
            body.put("fileName", safeFilename);
            if ("audio".equals(mediatype)) {
                body.put("ptt", true);
            }
            restTemplate.exchange(
                    props.getBaseUrl() + "/message/sendMedia/" + props.getInstanceName(),
                    HttpMethod.POST, new HttpEntity<>(body, headers), Map.class);
        } catch (Exception e) {
            log.warn("Falha ao enviar mídia WhatsApp para {}: {}", phoneNumber, e.toString());
        }
    }

    /** Best-effort push-to-talk/voice note audio send through Evolution API v2. */
    public void sendWhatsAppAudio(String phoneNumber, byte[] bytes) {
        if (!props.isConfigured()) {
            log.warn("Evolution API não configurada — áudio para {} não enviado", phoneNumber);
            return;
        }
        if (bytes == null || bytes.length == 0) return;
        try {
            HttpHeaders headers = new HttpHeaders();
            headers.setContentType(MediaType.APPLICATION_JSON);
            headers.set("apikey", props.getApiKey());
            Map<String, Object> body = new LinkedHashMap<>();
            body.put("number", phoneNumber);
            body.put("audio", Base64.getEncoder().encodeToString(bytes));
            restTemplate.exchange(
                    props.getBaseUrl() + "/message/sendWhatsAppAudio/" + props.getInstanceName(),
                    HttpMethod.POST, new HttpEntity<>(body, headers), Map.class);
        } catch (Exception e) {
            log.warn("Falha ao enviar áudio WhatsApp para {}: {}", phoneNumber, e.toString());
        }
    }

    /**
     * Lists WhatsApp groups the connected instance participates in, so the UI can offer a
     * picker instead of making the user hunt down a raw group JID. Returns raw maps (shape
     * not fully verified against a live Evolution API instance — parse defensively).
     */
    public java.util.List<Map<String, Object>> fetchGroups() {
        if (!props.isConfigured()) {
            log.warn("Evolution API não configurada — não é possível listar grupos");
            return java.util.List.of();
        }
        try {
            HttpHeaders headers = new HttpHeaders();
            headers.set("apikey", props.getApiKey());
            var resp = restTemplate.exchange(
                    props.getBaseUrl() + "/group/fetchAllGroups/" + props.getInstanceName() + "?getParticipants=false",
                    HttpMethod.GET, new HttpEntity<>(headers), java.util.List.class);
            java.util.List<?> body = resp.getBody();
            if (body == null) return java.util.List.of();
            java.util.List<Map<String, Object>> result = new java.util.ArrayList<>();
            for (Object o : body) {
                if (o instanceof Map<?, ?> m) {
                    @SuppressWarnings("unchecked")
                    Map<String, Object> casted = (Map<String, Object>) m;
                    result.add(casted);
                }
            }
            return result;
        } catch (Exception e) {
            log.warn("Falha ao buscar grupos do WhatsApp: {}", e.toString());
            return java.util.List.of();
        }
    }

    private String normalizeMime(String mime) {
        if (mime == null || mime.isBlank()) return "application/octet-stream";
        return mime.split(";", 2)[0].trim().toLowerCase(Locale.ROOT);
    }

    private String mediaType(String mime) {
        String m = normalizeMime(mime);
        if (m.startsWith("image/")) return "image";
        if (m.startsWith("video/")) return "video";
        if (m.startsWith("audio/")) return "audio";
        return "document";
    }

    private String defaultFilename(String mime) {
        return switch (mediaType(mime)) {
            case "image" -> "imagem.png";
            case "video" -> "video.mp4";
            case "audio" -> "audio.ogg";
            default -> "documento";
        };
    }

    private SimpleClientHttpRequestFactory createRequestFactory() {
        String baseUrl = props.getBaseUrl() == null ? "" : props.getBaseUrl().toLowerCase(Locale.ROOT);
        boolean internalHost = baseUrl.contains(".local") || baseUrl.contains("localhost");
        if (!internalHost) {
            return new SimpleClientHttpRequestFactory();
        }

        try {
            TrustManager[] trustAll = new TrustManager[]{new X509TrustManager() {
                @Override public void checkClientTrusted(X509Certificate[] chain, String authType) { }
                @Override public void checkServerTrusted(X509Certificate[] chain, String authType) { }
                @Override public X509Certificate[] getAcceptedIssuers() { return new X509Certificate[0]; }
            }};
            SSLContext context = SSLContext.getInstance("TLS");
            context.init(null, trustAll, new SecureRandom());
            HostnameVerifier verifier = (hostname, session) -> hostname != null &&
                    (hostname.endsWith(".local") || hostname.equalsIgnoreCase("localhost"));

            return new SimpleClientHttpRequestFactory() {
                @Override
                protected void prepareConnection(HttpURLConnection connection, String httpMethod) throws IOException {
                    if (connection instanceof HttpsURLConnection httpsConnection) {
                        httpsConnection.setSSLSocketFactory(context.getSocketFactory());
                        httpsConnection.setHostnameVerifier(verifier);
                    }
                    super.prepareConnection(connection, httpMethod);
                }
            };
        } catch (Exception e) {
            log.warn("Could not initialize internal Evolution API TLS trust override: {}", e.getMessage());
            return new SimpleClientHttpRequestFactory();
        }
    }
}
