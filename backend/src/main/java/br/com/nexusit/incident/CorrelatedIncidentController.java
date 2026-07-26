package br.com.nexusit.incident;

import lombok.RequiredArgsConstructor;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.security.core.Authentication;
import org.springframework.web.bind.annotation.*;

import java.util.Map;
import java.util.UUID;

@RestController
@RequestMapping("/api/incidents")
@RequiredArgsConstructor
public class CorrelatedIncidentController {
    private final CorrelatedIncidentService service;
    private final IncidentRunbookService runbookService;

    @GetMapping
    public IncidentListResponse list(@RequestParam(required = false, defaultValue = "OPEN") String status,
                                     @RequestParam(required = false) String sourceType,
                                     @RequestParam(required = false) String host,
                                     @RequestParam(required = false) Boolean withTicket,
                                     @RequestParam(required = false) Integer minSeverity,
                                     @RequestParam(required = false) Boolean recurrent) {
        return service.list(status, sourceType, host, withTicket, minSeverity, recurrent);
    }

    @GetMapping("/summary")
    public IncidentSummaryResponse summary() { return service.summary(); }

    @GetMapping("/{id}")
    public IncidentDetailResponse detail(@PathVariable UUID id) { return service.detail(id); }

    @GetMapping("/{id}/analysis")
    public Map<String, String> analysis(@PathVariable UUID id) { return Map.of("analysis", service.analyzeIncident(id)); }

    @GetMapping("/{id}/runbook")
    public IncidentRunbookResponse runbook(@PathVariable UUID id) { return runbookService.get(id); }

    @GetMapping("/{id}/action-results")
    public java.util.List<IncidentActionResultResponse> actionResults(@PathVariable UUID id) { return runbookService.recent(id); }

    @PostMapping("/{id}/actions/{actionKey}")
    @PreAuthorize("hasRole('ADMIN')")
    public IncidentActionResultResponse executeAction(@PathVariable UUID id, @PathVariable String actionKey, Authentication auth) {
        return runbookService.execute(id, actionKey, auth);
    }

    @PostMapping("/{id}/tickets")
    @PreAuthorize("hasRole('ADMIN')")
    public Map<String, Object> createTicket(@PathVariable UUID id, @RequestBody(required = false) Map<String, String> body) {
        return service.createOrReuseTicket(id, body == null ? null : body.get("reason"));
    }

    @PostMapping("/{id}/close")
    @PreAuthorize("hasRole('ADMIN')")
    public CorrelatedIncidentResponse close(@PathVariable UUID id, @RequestBody(required = false) IncidentStatusRequest req) {
        return service.closeIncident(id, req == null ? null : req.reason());
    }

    @PostMapping("/{id}/reopen")
    @PreAuthorize("hasRole('ADMIN')")
    public CorrelatedIncidentResponse reopen(@PathVariable UUID id, @RequestBody(required = false) IncidentStatusRequest req) {
        return service.reopenIncident(id, req == null ? null : req.reason());
    }
}
