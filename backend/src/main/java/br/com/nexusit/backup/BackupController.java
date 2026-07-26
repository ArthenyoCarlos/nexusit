package br.com.nexusit.backup;

import lombok.RequiredArgsConstructor;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.web.bind.annotation.*;

import java.util.List;
import java.util.UUID;

@RestController
@RequestMapping("/api/backups")
@RequiredArgsConstructor
public class BackupController {
    private final BackupService service;
    @GetMapping public BackupSummaryResponse summary() { return service.summary(); }
    @GetMapping("/{jobId}/runs") public List<BackupRunResponse> runs(@PathVariable UUID jobId) { return service.runs(jobId); }
    @PostMapping("/{jobId}/runs") @PreAuthorize("hasRole('ADMIN')") public BackupRunResponse recordRun(@PathVariable UUID jobId, @RequestBody BackupRunRequest req) { return service.recordRun(jobId, req); }
}
