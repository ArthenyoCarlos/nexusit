package br.com.nexusit.monitoring;

import com.fasterxml.jackson.databind.ObjectMapper;
import lombok.extern.slf4j.Slf4j;
import org.springframework.http.*;
import org.springframework.http.client.SimpleClientHttpRequestFactory;
import org.springframework.stereotype.Service;
import org.springframework.web.client.RestTemplate;

import java.util.LinkedHashMap;
import java.util.Map;
import java.util.concurrent.atomic.AtomicReference;

@Service
@Slf4j
public class ZabbixClient {

    private final ZabbixProperties props;
    private final RestTemplate restTemplate;
    private final AtomicReference<String> authToken = new AtomicReference<>();

    public ZabbixClient(ZabbixProperties props, ObjectMapper objectMapper) {
        this.props = props;
        var factory = new SimpleClientHttpRequestFactory();
        factory.setConnectTimeout(5000);
        factory.setReadTimeout(10000);
        this.restTemplate = new RestTemplate(factory);
    }

    @SuppressWarnings({"unchecked", "rawtypes"})
    public <T> T call(String method, Map<String, Object> params) {
        String token = authToken.get();
        if (token == null) token = authenticate();
        try {
            return (T) callInternal(method, params, token);
        } catch (ZabbixAuthException e) {
            token = authenticate();
            return (T) callInternal(method, params, token);
        }
    }

    private String authenticate() {
        // Try Zabbix 6.x field name first, fall back to 5.x
        try {
            Map<String, Object> params = new LinkedHashMap<>();
            params.put("username", props.getUser());
            params.put("password", props.getPassword());
            String token = (String) callInternal("user.login", params, null);
            authToken.set(token);
            return token;
        } catch (Exception e) {
            Map<String, Object> params = new LinkedHashMap<>();
            params.put("user", props.getUser());
            params.put("password", props.getPassword());
            String token = (String) callInternal("user.login", params, null);
            authToken.set(token);
            return token;
        }
    }

    @SuppressWarnings({"unchecked", "rawtypes"})
    private Object callInternal(String method, Map<String, Object> params, String auth) {
        Map<String, Object> body = new LinkedHashMap<>();
        body.put("jsonrpc", "2.0");
        body.put("method", method);
        body.put("params", params);
        if (auth != null && !auth.isBlank()) body.put("auth", auth);
        body.put("id", 1);

        HttpHeaders headers = new HttpHeaders();
        headers.setContentType(MediaType.APPLICATION_JSON);

        ResponseEntity<Map> resp = restTemplate.exchange(
                props.getApiUrl(), HttpMethod.POST,
                new HttpEntity<>(body, headers), Map.class);

        Map<String, Object> response = resp.getBody();
        if (response == null) throw new RuntimeException("Empty Zabbix response");

        if (response.containsKey("error")) {
            Map<String, Object> error = (Map<String, Object>) response.get("error");
            String msg = String.valueOf(error.getOrDefault("data", error.get("message")));
            if (msg.contains("re-login") || msg.contains("authoris") || msg.contains("session")
                    || msg.contains("Not authorized")) {
                throw new ZabbixAuthException(msg);
            }
            throw new RuntimeException("Zabbix error: " + msg);
        }

        return response.get("result");
    }

    static class ZabbixAuthException extends RuntimeException {
        ZabbixAuthException(String msg) { super(msg); }
    }
}
