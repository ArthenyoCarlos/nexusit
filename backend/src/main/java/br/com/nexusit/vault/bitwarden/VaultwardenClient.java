package br.com.nexusit.vault.bitwarden;

import lombok.extern.slf4j.Slf4j;
import org.springframework.http.HttpEntity;
import org.springframework.http.HttpHeaders;
import org.springframework.http.HttpMethod;
import org.springframework.http.MediaType;
import org.springframework.http.ResponseEntity;
import org.springframework.http.client.SimpleClientHttpRequestFactory;
import org.springframework.stereotype.Service;
import org.springframework.util.LinkedMultiValueMap;
import org.springframework.util.MultiValueMap;
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
import java.util.Locale;
import java.util.Map;
import java.util.UUID;

/** Thin HTTP client for the subset of the Bitwarden/Vaultwarden API needed to log in and create items. */
@Service
@Slf4j
class VaultwardenClient {

    private final VaultwardenProperties props;
    private final RestTemplate restTemplate;
    private final String deviceIdentifier = UUID.randomUUID().toString();

    VaultwardenClient(VaultwardenProperties props) {
        this.props = props;
        var factory = createRequestFactory();
        factory.setConnectTimeout(5000);
        factory.setReadTimeout(10000);
        this.restTemplate = new RestTemplate(factory);
    }

    @SuppressWarnings({"unchecked", "rawtypes"})
    Map<String, Object> prelogin(String email) {
        HttpHeaders headers = new HttpHeaders();
        headers.setContentType(MediaType.APPLICATION_JSON);
        ResponseEntity<Map> resp = restTemplate.exchange(
                url("/identity/accounts/prelogin"), HttpMethod.POST,
                new HttpEntity<>(Map.of("email", email), headers), Map.class);
        return (Map<String, Object>) resp.getBody();
    }

    @SuppressWarnings({"unchecked", "rawtypes"})
    Map<String, Object> login(String email, String masterPasswordHashB64) {
        MultiValueMap<String, String> form = new LinkedMultiValueMap<>();
        form.add("grant_type", "password");
        form.add("username", email);
        form.add("password", masterPasswordHashB64);
        form.add("scope", "api offline_access");
        form.add("client_id", "nexusit");
        form.add("deviceType", "21");
        form.add("deviceIdentifier", deviceIdentifier);
        form.add("deviceName", "nexusit-backend");

        HttpHeaders headers = new HttpHeaders();
        headers.setContentType(MediaType.APPLICATION_FORM_URLENCODED);
        ResponseEntity<Map> resp = restTemplate.exchange(
                url("/identity/connect/token"), HttpMethod.POST,
                new HttpEntity<>(form, headers), Map.class);
        return (Map<String, Object>) resp.getBody();
    }

    @SuppressWarnings({"unchecked", "rawtypes"})
    Map<String, Object> sync(String accessToken) {
        HttpHeaders headers = new HttpHeaders();
        headers.setBearerAuth(accessToken);
        ResponseEntity<Map> resp = restTemplate.exchange(
                url("/api/sync?excludeDomains=true"), HttpMethod.GET,
                new HttpEntity<>(headers), Map.class);
        return (Map<String, Object>) resp.getBody();
    }

    @SuppressWarnings({"unchecked", "rawtypes"})
    Map<String, Object> createCipher(String accessToken, Object cipherBody) {
        HttpHeaders headers = new HttpHeaders();
        headers.setBearerAuth(accessToken);
        headers.setContentType(MediaType.APPLICATION_JSON);
        ResponseEntity<Map> resp = restTemplate.exchange(
                url("/api/ciphers"), HttpMethod.POST,
                new HttpEntity<>(cipherBody, headers), Map.class);
        return (Map<String, Object>) resp.getBody();
    }

    private String url(String path) {
        return props.getBaseUrl() + path;
    }

    /** Same self-signed-cert allowance used by GlpiClient, scoped to internal/.local hosts only. */
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
            log.warn("Could not initialize internal Vaultwarden TLS trust override: {}", e.getMessage());
            return new SimpleClientHttpRequestFactory();
        }
    }
}
