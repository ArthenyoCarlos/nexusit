package br.com.nexusit.alerttriage;

import br.com.nexusit.user.User;
import lombok.RequiredArgsConstructor;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.*;

import java.util.Map;
import java.util.UUID;

@RestController
@RequestMapping("/api/monitoring/triage")
@RequiredArgsConstructor
public class AlertTriageController {
    private final AlertTriageService service;

    @GetMapping
    public AlertTriageSummary summary(@RequestParam(defaultValue = "true") boolean includeSuppressed) {
        return service.getSummary(includeSuppressed);
    }

    @PostMapping("/rules")
    @PreAuthorize("hasRole('ADMIN')")
    public AlertTriageRuleResponse createRule(@RequestBody AlertTriageRuleRequest req, @AuthenticationPrincipal User user) {
        return service.createRule(req, user);
    }

    @PutMapping("/rules/{id}")
    @PreAuthorize("hasRole('ADMIN')")
    public AlertTriageRuleResponse updateRule(@PathVariable UUID id, @RequestBody AlertTriageRuleRequest req) {
        return service.updateRule(id, req);
    }

    @PutMapping("/rules/{id}/enabled")
    @PreAuthorize("hasRole('ADMIN')")
    public AlertTriageRuleResponse enableRule(@PathVariable UUID id, @RequestBody Map<String, Boolean> body) {
        return service.enableRule(id, body.getOrDefault("enabled", true));
    }

    @PostMapping("/decisions")
    @PreAuthorize("hasRole('ADMIN')")
    public AlertTriageRuleResponse decide(@RequestBody AlertTriageDecisionRequest req, @AuthenticationPrincipal User user) {
        return service.decide(req, user);
    }

    @PostMapping("/tickets")
    @PreAuthorize("hasRole('ADMIN')")
    public Map<String, Object> createTicket(@RequestBody Map<String, String> body) {
        return service.createTicket(body.get("eventId"));
    }
}
