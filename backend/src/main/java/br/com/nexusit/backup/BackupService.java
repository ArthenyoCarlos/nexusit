package br.com.nexusit.backup;

import lombok.RequiredArgsConstructor;
import org.springframework.security.core.Authentication;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.List;
import java.util.UUID;

@Service
@RequiredArgsConstructor
@Transactional(readOnly = true)
public class BackupService {
    private final BackupJobRepository jobRepository;
    private final BackupRunRepository runRepository;
    private final BackupRestoreTestRepository restoreTestRepository;
    private final BackupActionRequestRepository actionRequestRepository;

    public BackupSummaryResponse summary() {
        List<BackupJobResponse> jobs = jobRepository.findAllByOrderBySystemNameAscNameAsc().stream()
                .map(this::toResponse)
                .toList();
        long queued = jobs.stream()
                .filter(j -> j.lastRequest() != null && ("QUEUED".equals(j.lastRequest().status()) || "RUNNING".equals(j.lastRequest().status())))
                .count();
        long restoreOk = jobs.stream().filter(j -> "RESTORE_OK".equals(j.restoreStatus())).count();
        long restoreProblem = jobs.stream().filter(j -> !"RESTORE_OK".equals(j.restoreStatus()) && !"DISABLED".equals(j.restoreStatus())).count();
        return new BackupSummaryResponse(
                jobs.size(), count(jobs,"OK"), count(jobs,"FAILED"), count(jobs,"STALE"), count(jobs,"NO_RUN"),
                restoreOk, restoreProblem, queued, jobs);
    }

    public List<BackupRunResponse> runs(UUID jobId) {
        return runRepository.findTop20ByJobIdOrderByFinishedAtDesc(jobId).stream().map(BackupRunResponse::from).toList();
    }

    public List<BackupRestoreTestResponse> restoreTests(UUID jobId) {
        return restoreTestRepository.findTop20ByJobIdOrderByTestedAtDesc(jobId).stream().map(BackupRestoreTestResponse::from).toList();
    }

    public List<BackupActionRequestResponse> requests(UUID jobId) {
        return actionRequestRepository.findTop20ByJobIdOrderByRequestedAtDesc(jobId).stream().map(BackupActionRequestResponse::from).toList();
    }

    @Transactional
    public BackupRunResponse recordRun(UUID jobId, BackupRunRequest req) {
        BackupJob job = jobRepository.findById(jobId).orElseThrow();
        BackupRun run = BackupRun.builder()
                .job(job)
                .status(normStatus(req.status()))
                .startedAt(req.startedAt())
                .finishedAt(req.finishedAt())
                .durationSeconds(req.durationSeconds())
                .sizeBytes(req.sizeBytes())
                .artifactRef(req.artifactRef())
                .message(req.message())
                .build();
        return BackupRunResponse.from(runRepository.save(run));
    }

    @Transactional
    public BackupRestoreTestResponse recordRestoreTest(UUID jobId, BackupRestoreTestRequest req, Authentication auth) {
        BackupJob job = jobRepository.findById(jobId).orElseThrow();
        BackupRestoreTest test = BackupRestoreTest.builder()
                .job(job)
                .status(normStatus(req.status()))
                .testedAt(req.testedAt())
                .durationSeconds(req.durationSeconds())
                .testedArtifactRef(req.testedArtifactRef())
                .message(req.message())
                .validatedBy(req.validatedBy() == null || req.validatedBy().isBlank() ? username(auth) : req.validatedBy())
                .build();
        return BackupRestoreTestResponse.from(restoreTestRepository.save(test));
    }

    @Transactional
    public BackupActionRequestResponse enqueue(UUID jobId, String action, Authentication auth) {
        BackupJob job = jobRepository.findById(jobId).orElseThrow();
        String normalized = normStatus(action);
        if (!"BACKUP".equals(normalized) && !"RESTORE_TEST".equals(normalized)) {
            throw new IllegalArgumentException("Ação inválida: " + action);
        }
        BackupActionRequest request = BackupActionRequest.builder()
                .job(job)
                .action(normalized)
                .status("QUEUED")
                .requestedBy(username(auth))
                .build();
        return BackupActionRequestResponse.from(actionRequestRepository.save(request));
    }

    private BackupJobResponse toResponse(BackupJob job) {
        BackupRunResponse run = runRepository.findTopByJobIdOrderByFinishedAtDesc(job.getId()).map(BackupRunResponse::from).orElse(null);
        BackupRestoreTestResponse restore = restoreTestRepository.findTopByJobIdOrderByTestedAtDesc(job.getId()).map(BackupRestoreTestResponse::from).orElse(null);
        BackupActionRequestResponse request = actionRequestRepository.findTop20ByJobIdOrderByRequestedAtDesc(job.getId()).stream().findFirst().map(BackupActionRequestResponse::from).orElse(null);
        return BackupJobResponse.from(job, run, restore, request);
    }

    private static long count(List<BackupJobResponse> jobs, String status) {
        return jobs.stream().filter(j -> status.equals(j.healthStatus())).count();
    }

    private static String normStatus(String s) {
        if (s == null || s.isBlank()) return "UNKNOWN";
        return s.trim().toUpperCase();
    }

    private static String username(Authentication auth) {
        return auth == null || auth.getName() == null ? "nexusit" : auth.getName();
    }
}
