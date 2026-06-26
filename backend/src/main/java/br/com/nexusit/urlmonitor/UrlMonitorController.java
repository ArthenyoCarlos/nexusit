package br.com.nexusit.urlmonitor;

import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.web.bind.annotation.*;

import java.util.List;
import java.util.UUID;

@RestController
@RequestMapping("/api/url-monitor")
@RequiredArgsConstructor
public class UrlMonitorController {

    private final UrlMonitorService service;

    @GetMapping
    public List<UrlMonitorResponse> findAll() { return service.findAll(); }

    @PostMapping
    @PreAuthorize("hasRole('ADMIN')")
    public ResponseEntity<UrlMonitorResponse> create(@Valid @RequestBody UrlMonitorRequest req) {
        return ResponseEntity.status(HttpStatus.CREATED).body(service.create(req));
    }

    @PutMapping("/{id}")
    @PreAuthorize("hasRole('ADMIN')")
    public UrlMonitorResponse update(@PathVariable UUID id, @Valid @RequestBody UrlMonitorRequest req) {
        return service.update(id, req);
    }

    @DeleteMapping("/{id}")
    @PreAuthorize("hasRole('ADMIN')")
    public ResponseEntity<Void> delete(@PathVariable UUID id) {
        service.delete(id);
        return ResponseEntity.noContent().build();
    }

    @PostMapping("/{id}/check")
    public UrlMonitorResponse checkNow(@PathVariable UUID id) {
        return service.checkNow(id);
    }
}
