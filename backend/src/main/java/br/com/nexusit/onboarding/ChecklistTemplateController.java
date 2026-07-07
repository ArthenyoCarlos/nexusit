package br.com.nexusit.onboarding;

import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.web.bind.annotation.*;

import java.util.List;
import java.util.UUID;

@RestController
@RequestMapping("/api/onboarding/templates")
@RequiredArgsConstructor
public class ChecklistTemplateController {

    private final ChecklistTemplateService service;

    @GetMapping
    public List<ChecklistTemplateResponse> findAll(@RequestParam(required = false) String type) {
        return service.findAll(type);
    }

    @GetMapping("/active")
    public List<ChecklistTemplateResponse> findActive(@RequestParam String type) {
        return service.findActive(type);
    }

    @GetMapping("/{id}")
    public ChecklistTemplateResponse findById(@PathVariable UUID id) { return service.findById(id); }

    @PostMapping
    @PreAuthorize("hasRole('ADMIN')")
    public ResponseEntity<ChecklistTemplateResponse> create(@Valid @RequestBody ChecklistTemplateRequest req) {
        return ResponseEntity.status(HttpStatus.CREATED).body(service.create(req));
    }

    @PutMapping("/{id}")
    @PreAuthorize("hasRole('ADMIN')")
    public ChecklistTemplateResponse update(@PathVariable UUID id, @Valid @RequestBody ChecklistTemplateRequest req) {
        return service.update(id, req);
    }

    @DeleteMapping("/{id}")
    @PreAuthorize("hasRole('ADMIN')")
    public ResponseEntity<Void> delete(@PathVariable UUID id) {
        service.delete(id);
        return ResponseEntity.noContent().build();
    }
}
