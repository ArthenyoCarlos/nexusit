package br.com.nexusit.monitoring.ts;

import com.fasterxml.jackson.databind.ObjectMapper;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Service;

import java.time.Clock;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;

@Service
public class TsSessionsService {
    private final ObjectMapper mapper;
    private final String snapshotPath;
    private final Clock clock;

    @Autowired
    public TsSessionsService(ObjectMapper mapper,
            @Value("${monitoring.ts.snapshot-path:/home/galdino/.hermes/state/ts_sessions.json}") String snapshotPath) {
        this(mapper, snapshotPath, Clock.systemUTC());
    }

    TsSessionsService(ObjectMapper mapper, String snapshotPath, Clock clock) {
        this.mapper = mapper;
        this.snapshotPath = snapshotPath;
        this.clock = clock;
    }

    public Map<String, Object> getSnapshot() {
        try {
            com.fasterxml.jackson.databind.JsonNode root = mapper.reader()
                    .with(com.fasterxml.jackson.databind.DeserializationFeature.FAIL_ON_TRAILING_TOKENS)
                    .readTree(java.nio.file.Files.readAllBytes(java.nio.file.Path.of(snapshotPath)));
            validate(root);
            Map<String, Object> result = mapper.convertValue(root,
                    new com.fasterxml.jackson.core.type.TypeReference<LinkedHashMap<String, Object>>() {});
            java.time.Instant collectedAt = java.time.Instant.parse((String) result.get("collectedAt"));
            java.time.Instant lastSuccessAt = result.get("lastSuccessAt") == null ? null
                    : java.time.Instant.parse((String) result.get("lastSuccessAt"));
            if (collectedAt.isAfter(clock.instant()) || (lastSuccessAt != null && lastSuccessAt.isAfter(collectedAt))) {
                return unavailable();
            }
            Long age = lastSuccessAt == null ? null
                    : java.time.Duration.between(lastSuccessAt, clock.instant()).getSeconds();
            boolean stale = age == null || age > 180;
            boolean failed = "ERROR".equals(result.get("status"));
            result.put("stale", stale);
            result.put("collectionAgeSeconds", age);
            result.put("complianceCurrent", !stale && !failed);
            if (stale && !failed) {
                result.put("status", "STALE");
            }
            if (stale || failed) {
                invalidateCompliance(result);
            }
            result.put("readOnly", true);
            // Never expose the collector's raw diagnostic: it may contain paths or credentials.
            result.put("error", failed ? "Falha na coleta de sessões TS." : null);
            return result;
        } catch (Exception ignored) {
            return unavailable();
        }
    }

    private void validate(com.fasterxml.jackson.databind.JsonNode root) {
        if (root == null || !root.isObject()
                || !root.path("server").isTextual() || !root.path("ip").isTextual()
                || !List.of("OK", "ERROR").contains(root.path("status").asText())
                || !root.path("collectedAt").isTextual()
                || !(root.path("lastSuccessAt").isTextual()
                    || ("ERROR".equals(root.path("status").asText()) && root.path("lastSuccessAt").isNull()))
                || !root.path("sessions").isArray() || !root.path("events").isArray()
                || !root.path("summary").isObject() || !root.path("policy").isObject()) {
            throw new IllegalArgumentException("Invalid snapshot");
        }
        var policy = root.path("policy");
        require("OBSERVE_ONLY".equals(policy.path("mode").asText())
                && policy.path("effectivePolicy").isObject()
                && policy.path("disconnectLimitMinutes").isIntegralNumber()
                && policy.path("disconnectLimitMinutes").asInt() == 30
                && policy.path("toleranceSeconds").isIntegralNumber()
                && policy.path("toleranceSeconds").asInt() == 120);
        for (String key : List.of("total", "active", "disconnected", "overdue", "exempt", "unknown")) {
            var value = root.path("summary").path(key);
            require(value.isIntegralNumber() && value.canConvertToInt() && value.asInt() >= 0);
        }
        for (var session : root.path("sessions")) {
            require(session.isObject() && session.path("id").isIntegralNumber()
                    && session.path("id").canConvertToInt() && session.path("id").asInt() >= 0
                    && session.path("user").isTextual() && session.path("state").isTextual()
                    && List.of("ACTIVE", "EXEMPT", "WITHIN_LIMIT", "OVERDUE", "UNKNOWN")
                            .contains(session.path("compliance").asText()));
            require(session.path("isAdmin").isNull() || session.path("isAdmin").isBoolean());
            var seconds = session.path("disconnectedSeconds");
            require(seconds.isNull() || (seconds.isIntegralNumber() && seconds.asLong() >= 0));
            validateOptionalTime(session.path("logonAt"));
            validateOptionalTime(session.path("disconnectedAt"));
        }
        for (var event : root.path("events")) {
            require(event.isObject() && event.path("at").isTextual());
            validateOptionalTime(event.path("at"));
        }
    }

    private void validateOptionalTime(com.fasterxml.jackson.databind.JsonNode value) {
        if (value.isNull()) return;
        require(value.isTextual());
        require(!java.time.Instant.parse(value.asText()).isAfter(clock.instant()));
    }

    private static void require(boolean valid) {
        if (!valid) throw new IllegalArgumentException("Invalid snapshot");
    }

    @SuppressWarnings("unchecked")
    private void invalidateCompliance(Map<String, Object> result) {
        for (Map<String, Object> session : (List<Map<String, Object>>) result.get("sessions")) {
            session.put("compliance", "UNKNOWN");
        }
        Map<String, Object> summary = (Map<String, Object>) result.get("summary");
        for (String key : List.of("overdue", "exempt", "unknown")) {
            summary.put(key, null);
        }
    }

    private Map<String, Object> unavailable() {
        Map<String, Object> result = new LinkedHashMap<>();
        result.put("server", "TS-VM");
        result.put("ip", "192.168.2.100");
        result.put("collectedAt", null);
        result.put("lastSuccessAt", null);
        result.put("status", "UNAVAILABLE");
        result.put("error", "Snapshot de sessões TS indisponível ou inválido.");
        result.put("stale", true);
        result.put("collectionAgeSeconds", null);
        result.put("complianceCurrent", false);
        result.put("readOnly", true);
        result.put("policy", Map.of("disconnectLimitMinutes", 30, "toleranceSeconds", 120,
                "mode", "OBSERVE_ONLY", "effectivePolicy", Map.of()));
        result.put("sessions", List.of());
        result.put("events", List.of());
        Map<String, Object> summary = new LinkedHashMap<>();
        for (String key : List.of("total", "active", "disconnected", "overdue", "exempt", "unknown")) {
            summary.put(key, null);
        }
        result.put("summary", summary);
        return result;
    }
}
