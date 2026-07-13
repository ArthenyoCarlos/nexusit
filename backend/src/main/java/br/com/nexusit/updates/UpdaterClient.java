package br.com.nexusit.updates;

import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.http.HttpEntity;
import org.springframework.http.HttpHeaders;
import org.springframework.http.HttpMethod;
import org.springframework.http.ResponseEntity;
import org.springframework.http.client.SimpleClientHttpRequestFactory;
import org.springframework.stereotype.Service;
import org.springframework.web.client.RestTemplate;

import java.util.Map;

/**
 * Fala com o NexusUpdater — um servico auxiliar separado (fora deste container) que tem
 * permissao para git pull + docker compose rebuild. Isolado de propósito: se este backend
 * for comprometido, ele não ganha, por tabela, poder de reescrever o host.
 */
@Service
@Slf4j
public class UpdaterClient {

    @Value("${app.updater.url}")
    private String baseUrl;

    @Value("${app.updater.token}")
    private String token;

    private final RestTemplate restTemplate;

    public UpdaterClient() {
        SimpleClientHttpRequestFactory factory = new SimpleClientHttpRequestFactory();
        factory.setConnectTimeout(4000);
        factory.setReadTimeout(8000);
        this.restTemplate = new RestTemplate(factory);
    }

    public UpdateStatus getStatus() {
        try {
            ResponseEntity<Map> resp = restTemplate.exchange(
                    baseUrl + "/status", HttpMethod.GET, new HttpEntity<>(authHeaders()), Map.class);
            Map<?, ?> body = resp.getBody();
            if (body == null) return UpdateStatus.unavailable();
            return new UpdateStatus(
                    str(body, "currentCommit"),
                    str(body, "latestCommit"),
                    Boolean.TRUE.equals(body.get("updateAvailable")),
                    str(body, "changelog"),
                    Boolean.TRUE.equals(body.get("updating")),
                    str(body, "lastUpdateAt"),
                    str(body, "lastError"),
                    true
            );
        } catch (Exception e) {
            log.debug("NexusUpdater indisponível: {}", e.getMessage());
            return UpdateStatus.unavailable();
        }
    }

    public boolean triggerUpdate() {
        try {
            restTemplate.exchange(baseUrl + "/update", HttpMethod.POST, new HttpEntity<>(authHeaders()), Map.class);
            return true;
        } catch (Exception e) {
            log.warn("Falha ao acionar NexusUpdater: {}", e.getMessage());
            return false;
        }
    }

    private HttpHeaders authHeaders() {
        HttpHeaders headers = new HttpHeaders();
        headers.set("X-Updater-Token", token);
        return headers;
    }

    private static String str(Map<?, ?> m, String key) {
        Object v = m.get(key);
        return v != null ? v.toString() : null;
    }
}
