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

    public EvolutionApiClient(EvolutionApiProperties props) {
        this.props = props;
        var factory = createRequestFactory();
        factory.setConnectTimeout(5000);
        factory.setReadTimeout(10000);
        this.restTemplate = new RestTemplate(factory);
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
