package br.com.nexusit.audit;

import lombok.RequiredArgsConstructor;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.web.bind.annotation.*;

import java.util.List;

@RestController
@RequestMapping("/api/audit")
@RequiredArgsConstructor
@PreAuthorize("hasRole('ADMIN')")
public class AuditController {

    private final AuditService service;

    @GetMapping
    public List<AuditEventResponse> findRecent(
            @RequestParam(defaultValue = "30") int days,
            @RequestParam(required = false) AuditModule module) {
        return service.findRecent(days, module);
    }
}
