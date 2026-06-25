package br.com.nexusit.monitoring;

import lombok.RequiredArgsConstructor;
import org.springframework.web.bind.annotation.*;

import java.util.List;

@RestController
@RequestMapping("/api/monitoring")
@RequiredArgsConstructor
public class ZabbixController {

    private final ZabbixService service;

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
    public ZabbixMetrics getMetrics(@PathVariable String id) {
        return service.getHostMetrics(id);
    }
}
