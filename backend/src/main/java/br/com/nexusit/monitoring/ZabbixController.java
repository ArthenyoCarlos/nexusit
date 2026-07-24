package br.com.nexusit.monitoring;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import lombok.RequiredArgsConstructor;
import org.springframework.web.bind.annotation.*;

import java.io.IOException;
import java.nio.file.Files;
import java.nio.file.Path;
import java.util.List;

@RestController
@RequestMapping("/api/monitoring")
@RequiredArgsConstructor
public class ZabbixController {

    private static final Path UNIFI_AP_SNAPSHOT = Path.of(
            System.getenv().getOrDefault("UNIFI_AP_SNAPSHOT_PATH", "/home/galdino/.hermes/state/unifi_ap_monitor_snapshot.json"));

    private final ZabbixService service;
    private final UnifiApHistoryService unifiApHistoryService;
    private final UnifiApInstabilityService unifiApInstabilityService;
    private final ObjectMapper objectMapper;

    @GetMapping("/hosts")
    public List<ZabbixHost> getHosts() {
        return service.getHosts();
    }

    @GetMapping("/problems")
    public List<ZabbixProblem> getProblems() {
        return service.getProblems();
    }

    @GetMapping("/history")
    public List<ZabbixHistoryEntry> getHistory(
            @RequestParam(defaultValue = "24") int hours) {
        return service.getRecentHistory(hours);
    }

    @GetMapping("/hosts/{id}/metrics")
    public ZabbixMetrics getMetrics(@PathVariable String id, @RequestParam(defaultValue = "2") int hours) {
        return service.getHostMetrics(id, hours);
    }

    @GetMapping("/unifi-aps")
    public JsonNode getUnifiApPanel() throws IOException {
        if (!Files.exists(UNIFI_AP_SNAPSHOT)) {
            var root = objectMapper.createObjectNode();
            root.put("generatedAt", 0);
            root.put("windowHours", 24);
            root.set("aps", objectMapper.createArrayNode());
            var collector = objectMapper.createObjectNode();
            collector.put("snapshot", UNIFI_AP_SNAPSHOT.toString());
            collector.put("missing", true);
            root.set("collector", collector);
            return root;
        }
        return objectMapper.readTree(UNIFI_AP_SNAPSHOT.toFile());
    }

    @GetMapping("/unifi-aps/history")
    public List<UnifiApMetricPoint> getUnifiApHistory(@RequestParam String apName, @RequestParam(defaultValue = "24") int hours) {
        return unifiApHistoryService.getHistory(apName, hours);
    }

    @GetMapping("/unifi-aps/instability")
    public UnifiApInstabilitySummary getUnifiApInstability() {
        return unifiApInstabilityService.getInstability();
    }

    @PostMapping("/unifi-aps/instability/tickets")
    public java.util.Map<String, Object> createUnifiApInvestigationTicket(@RequestBody UnifiApInvestigationTicketRequest request) {
        return unifiApInstabilityService.createInvestigationTicket(request.apName(), request.reason());
    }
}
