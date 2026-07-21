package br.com.nexusit.monitoring;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.nio.file.Files;
import java.nio.file.Path;
import java.time.LocalDateTime;
import java.time.ZoneId;
import java.util.List;

/**
 * O snapshot do coletor Hermes (JSON externo a este repo) só traz agregados das últimas
 * 24h por AP, sem amostra ponto-a-ponto — então é este serviço quem monta o histórico:
 * a cada captura, salva uma linha por AP com o estado atual, formando a série temporal
 * que o painel de APs UniFi usa pra desenhar o gráfico por período.
 */
@Service
@RequiredArgsConstructor
@Slf4j
public class UnifiApHistoryService {

    private static final Path UNIFI_AP_SNAPSHOT = Path.of(
            System.getenv().getOrDefault("UNIFI_AP_SNAPSHOT_PATH", "/home/galdino/.hermes/state/unifi_ap_monitor_snapshot.json"));

    private final UnifiApMetricSampleRepository repository;
    private final ObjectMapper objectMapper;

    @Scheduled(fixedDelay = 300000)
    @Transactional
    public void captureSnapshot() {
        if (!Files.exists(UNIFI_AP_SNAPSHOT)) return;
        try {
            JsonNode root = objectMapper.readTree(UNIFI_AP_SNAPSHOT.toFile());
            JsonNode apsNode = root.path("aps");
            if (!apsNode.isArray()) return;

            LocalDateTime now = LocalDateTime.now();
            for (JsonNode apNode : apsNode) {
                String name = apNode.path("name").asText(null);
                if (name == null || name.isBlank()) continue;

                repository.save(UnifiApMetricSample.builder()
                        .apName(name)
                        .recordedAt(now)
                        .lossPct(numberOrNull(apNode, "lastLossPct"))
                        .rttMs(numberOrNull(apNode, "avgRttMs"))
                        .clientCount(intOrNull(apNode, "currentClientCount"))
                        .build());
            }
        } catch (Exception e) {
            log.warn("Falha ao capturar snapshot de métricas dos APs UniFi: {}", e.getMessage());
        }
    }

    public List<UnifiApMetricPoint> getHistory(String apName, int hours) {
        LocalDateTime since = LocalDateTime.now().minusHours(Math.max(1, hours));
        return repository.findByApNameAndRecordedAtAfterOrderByRecordedAtAsc(apName, since).stream()
                .map(s -> new UnifiApMetricPoint(
                        s.getRecordedAt().atZone(ZoneId.systemDefault()).toEpochSecond(),
                        s.getLossPct(), s.getRttMs(), s.getClientCount()))
                .toList();
    }

    private Double numberOrNull(JsonNode node, String field) {
        JsonNode v = node.get(field);
        return v != null && v.isNumber() ? v.asDouble() : null;
    }

    private Integer intOrNull(JsonNode node, String field) {
        JsonNode v = node.get(field);
        return v != null && v.isNumber() ? v.asInt() : null;
    }
}
