package br.com.nexusit.monitoring.ts;

import org.springframework.http.CacheControl;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RestController;

import java.util.Map;

@RestController
public class TsSessionsController {
    private final TsSessionsService service;

    public TsSessionsController(TsSessionsService service) {
        this.service = service;
    }

    // Monitoring has a legacy permitAll matcher. Method security deliberately protects
    // this endpoint without changing access rules for existing monitoring dashboards.
    @PreAuthorize("isAuthenticated()")
    @GetMapping("/api/monitoring/ts-sessions")
    public ResponseEntity<Map<String, Object>> getSessions() {
        return ResponseEntity.ok().cacheControl(CacheControl.noStore()).body(service.getSnapshot());
    }
}
