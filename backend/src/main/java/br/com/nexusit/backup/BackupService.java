package br.com.nexusit.backup;

import lombok.RequiredArgsConstructor;
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

    public BackupSummaryResponse summary() {
        List<BackupJobResponse> jobs = jobRepository.findAllByOrderBySystemNameAscNameAsc().stream()
                .map(j -> BackupJobResponse.from(j, runRepository.findTopByJobIdOrderByFinishedAtDesc(j.getId()).map(BackupRunResponse::from).orElse(null)))
                .toList();
        return new BackupSummaryResponse(jobs.size(), count(jobs,"OK"), count(jobs,"FAILED"), count(jobs,"STALE"), count(jobs,"NO_RUN"), jobs);
    }
    public List<BackupRunResponse> runs(UUID jobId) {
        return runRepository.findTop20ByJobIdOrderByFinishedAtDesc(jobId).stream().map(BackupRunResponse::from).toList();
    }
    @Transactional
    public BackupRunResponse recordRun(UUID jobId, BackupRunRequest req) {
        BackupJob job = jobRepository.findById(jobId).orElseThrow();
        BackupRun run = BackupRun.builder().job(job).status(normStatus(req.status())).startedAt(req.startedAt()).finishedAt(req.finishedAt()).durationSeconds(req.durationSeconds()).sizeBytes(req.sizeBytes()).artifactRef(req.artifactRef()).message(req.message()).build();
        return BackupRunResponse.from(runRepository.save(run));
    }
    private static long count(List<BackupJobResponse> jobs, String status) { return jobs.stream().filter(j -> status.equals(j.healthStatus())).count(); }
    private static String normStatus(String s) { if (s == null || s.isBlank()) return "UNKNOWN"; return s.trim().toUpperCase(); }
}
