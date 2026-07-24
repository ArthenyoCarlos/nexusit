package br.com.nexusit.incident;

import lombok.RequiredArgsConstructor;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.web.bind.annotation.*;

import java.util.Map;
import java.util.UUID;

@RestController
@RequestMapping("/api/incidents")
@RequiredArgsConstructor
public class CorrelatedIncidentController {
    private final CorrelatedIncidentService service;

    @GetMapping
    public IncidentListResponse listOpen() {
        return service.listOpen();
    }

    @GetMapping("/{id}")
    public IncidentDetailResponse detail(@PathVariable UUID id) {
        return service.detail(id);
    }

    @GetMapping("/{id}/analysis")
    public Map<String, String> analysis(@PathVariable UUID id) {
        return Map.of("analysis", service.analyzeIncident(id));
    }

    @PostMapping("/{id}/tickets")
    @PreAuthorize("hasRole('ADMIN')")
    public Map<String, Object> createTicket(@PathVariable UUID id, @RequestBody(required = false) Map<String, String> body) {
        return service.createOrReuseTicket(id, body == null ? null : body.get("reason"));
    }
}
