package br.com.nexusit.glpi;

import lombok.extern.slf4j.Slf4j;
import org.springframework.http.*;
import org.springframework.http.client.SimpleClientHttpRequestFactory;
import org.springframework.stereotype.Service;
import org.springframework.web.client.HttpClientErrorException;
import org.springframework.web.client.RestTemplate;
import org.springframework.web.util.UriComponentsBuilder;

import javax.net.ssl.HostnameVerifier;
import javax.net.ssl.HttpsURLConnection;
import javax.net.ssl.SSLContext;
import javax.net.ssl.TrustManager;
import javax.net.ssl.X509TrustManager;
import java.io.IOException;
import java.net.HttpURLConnection;
import java.security.SecureRandom;
import java.security.cert.X509Certificate;
import java.util.List;
import java.util.Locale;
import java.util.Map;
import java.util.concurrent.atomic.AtomicReference;

@Service
@Slf4j
public class GlpiClient {

    private final GlpiProperties props;
    private final RestTemplate restTemplate;
    private final AtomicReference<String> sessionToken = new AtomicReference<>();

    public GlpiClient(GlpiProperties props) {
        this.props = props;
        var factory = createRequestFactory();
        factory.setConnectTimeout(5000);
        factory.setReadTimeout(10000);
        this.restTemplate = new RestTemplate(factory);
    }

    // ── Session ───────────────────────────────────────────────────────────

    @SuppressWarnings({"unchecked", "rawtypes"})
    private String initSession() {
        HttpHeaders headers = buildBaseHeaders(null);
        headers.set("Authorization", "user_token " + props.getUserToken());

        ResponseEntity<Map> resp = restTemplate.exchange(
                url("/initSession"), HttpMethod.GET,
                new HttpEntity<>(headers), Map.class);

        String token = String.valueOf(resp.getBody().get("session_token"));
        sessionToken.set(token);
        log.debug("GLPI session initialized");
        return token;
    }

    private String session() {
        String token = sessionToken.get();
        return token != null ? token : initSession();
    }

    // ── HTTP helpers ──────────────────────────────────────────────────────

    @SuppressWarnings({"unchecked", "rawtypes"})
    public List<Map<String, Object>> getList(String path, Map<String, String> params) {
        return withRetry(() -> {
            String u = buildUrl(path, params);
            ResponseEntity<List> resp = restTemplate.exchange(
                    u, HttpMethod.GET, new HttpEntity<>(buildBaseHeaders(session())), List.class);
            return (List<Map<String, Object>>) resp.getBody();
        });
    }

    @SuppressWarnings({"unchecked", "rawtypes"})
    public Map<String, Object> getOne(String path, Map<String, String> params) {
        return withRetry(() -> {
            String u = buildUrl(path, params);
            ResponseEntity<Map> resp = restTemplate.exchange(
                    u, HttpMethod.GET, new HttpEntity<>(buildBaseHeaders(session())), Map.class);
            return (Map<String, Object>) resp.getBody();
        });
    }

    @SuppressWarnings({"unchecked", "rawtypes"})
    public Map<String, Object> post(String path, Object body) {
        return withRetry(() -> {
            HttpHeaders headers = buildBaseHeaders(session());
            headers.setContentType(MediaType.APPLICATION_JSON);
            ResponseEntity<Map> resp = restTemplate.exchange(
                    url(path), HttpMethod.POST,
                    new HttpEntity<>(body, headers), Map.class);
            return (Map<String, Object>) resp.getBody();
        });
    }

    public void put(String path, Object body) {
        withRetry(() -> {
            HttpHeaders headers = buildBaseHeaders(session());
            headers.setContentType(MediaType.APPLICATION_JSON);
            restTemplate.exchange(url(path), HttpMethod.PUT,
                    new HttpEntity<>(body, headers), Void.class);
            return null;
        });
    }

    @SuppressWarnings({"unchecked", "rawtypes"})
    public Map<String, Object> postMultipart(String path, org.springframework.util.MultiValueMap<String, Object> parts) {
        return withRetry(() -> {
            HttpHeaders headers = buildBaseHeaders(session());
            headers.setContentType(MediaType.MULTIPART_FORM_DATA);
            ResponseEntity<Map> resp = restTemplate.exchange(
                    url(path), HttpMethod.POST, new HttpEntity<>(parts, headers), Map.class);
            return (Map<String, Object>) resp.getBody();
        });
    }

    // ── Internals ─────────────────────────────────────────────────────────

    private SimpleClientHttpRequestFactory createRequestFactory() {
        String apiUrl = props.getApiUrl() == null ? "" : props.getApiUrl().toLowerCase(Locale.ROOT);
        boolean internalGlpi = apiUrl.contains("glpi.local") || apiUrl.contains(".local/") || apiUrl.contains("localhost");
        if (!internalGlpi) {
            return new SimpleClientHttpRequestFactory();
        }

        try {
            TrustManager[] trustAll = new TrustManager[] { new X509TrustManager() {
                @Override public void checkClientTrusted(X509Certificate[] chain, String authType) { }
                @Override public void checkServerTrusted(X509Certificate[] chain, String authType) { }
                @Override public X509Certificate[] getAcceptedIssuers() { return new X509Certificate[0]; }
            }};
            SSLContext context = SSLContext.getInstance("TLS");
            context.init(null, trustAll, new SecureRandom());
            HostnameVerifier verifier = (hostname, session) -> hostname != null && (
                    hostname.equalsIgnoreCase("glpi.local") ||
                    hostname.endsWith(".local") ||
                    hostname.equalsIgnoreCase("localhost")
            );

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
            log.warn("Could not initialize internal GLPI TLS trust override: {}", e.getMessage());
            return new SimpleClientHttpRequestFactory();
        }
    }

    private <T> T withRetry(java.util.function.Supplier<T> supplier) {
        try {
            return supplier.get();
        } catch (HttpClientErrorException e) {
            if (e.getStatusCode() == HttpStatus.UNAUTHORIZED || e.getStatusCode() == HttpStatus.FORBIDDEN) {
                sessionToken.set(null);
                initSession();
                return supplier.get();
            }
            throw e;
        }
    }

    private HttpHeaders buildBaseHeaders(String token) {
        HttpHeaders headers = new HttpHeaders();
        headers.set("App-Token", props.getAppToken());
        if (token != null) headers.set("Session-Token", token);
        return headers;
    }

    private String url(String path) {
        return props.getApiUrl() + path;
    }

    private String buildUrl(String path, Map<String, String> params) {
        UriComponentsBuilder builder = UriComponentsBuilder.fromHttpUrl(url(path));
        if (params != null) params.forEach(builder::queryParam);
        return builder.toUriString();
    }
}
