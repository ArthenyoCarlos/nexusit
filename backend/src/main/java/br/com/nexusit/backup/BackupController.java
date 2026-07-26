package br.com.nexusit.backup;

import lombok.RequiredArgsConstructor;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.security.core.Authentication;
import org.springframework.web.bind.annotation.*;

import java.util.List;
import java.util.Map;
import java.util.UUID;

@RestController
@RequestMapping("/api/backups")
@RequiredArgsConstructor
public class BackupController {
    private final BackupService service;

    @GetMapping
    public BackupSummaryResponse summary() { return service.summary(); }

    @GetMapping("/{jobId}/runs")
    public List<BackupRunResponse> runs(@PathVariable UUID jobId) { return service.runs(jobId); }

    @GetMapping("/{jobId}/restore-tests")
    public List<BackupRestoreTestResponse> restoreTests(@PathVariable UUID jobId) { return service.restoreTests(jobId); }

    @GetMapping("/{jobId}/requests")
    public List<BackupActionRequestResponse> requests(@PathVariable UUID jobId) { return service.requests(jobId); }

    @PostMapping("/{jobId}/runs")
    @PreAuthorize("hasRole('ADMIN')")
    public BackupRunResponse recordRun(@PathVariable UUID jobId, @RequestBody BackupRunRequest req) { return service.recordRun(jobId, req); }

    @PostMapping("/{jobId}/restore-tests")
    @PreAuthorize("hasRole('ADMIN')")
    public BackupRestoreTestResponse recordRestoreTest(@PathVariable UUID jobId, @RequestBody BackupRestoreTestRequest req, Authentication auth) {
        return service.recordRestoreTest(jobId, req, auth);
    }

    @PostMapping("/{jobId}/backup-now")
    @PreAuthorize("hasRole('ADMIN')")
    public BackupActionRequestResponse backupNow(@PathVariable UUID jobId, Authentication auth) {
        return service.enqueue(jobId, "BACKUP", auth);
    }

    @PostMapping("/{jobId}/restore-test-now")
    @PreAuthorize("hasRole('ADMIN')")
    public BackupActionRequestResponse restoreTestNow(@PathVariable UUID jobId, Authentication auth) {
        return service.enqueue(jobId, "RESTORE_TEST", auth);
    }

    @PostMapping("/{jobId}/actions")
    @PreAuthorize("hasRole('ADMIN')")
    public BackupActionRequestResponse enqueue(@PathVariable UUID jobId, @RequestBody Map<String, String> body, Authentication auth) {
        return service.enqueue(jobId, body == null ? null : body.get("action"), auth);
    }
}
