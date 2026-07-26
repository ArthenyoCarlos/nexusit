package br.com.nexusit.backup;

import java.time.LocalDateTime;
import java.util.UUID;

public record BackupRunResponse(UUID id, UUID jobId, String status, LocalDateTime startedAt, LocalDateTime finishedAt, Integer durationSeconds, Long sizeBytes, String artifactRef, String message) {
    public static BackupRunResponse from(BackupRun run) {
        if (run == null) return null;
        return new BackupRunResponse(run.getId(), run.getJob().getId(), run.getStatus(), run.getStartedAt(), run.getFinishedAt(), run.getDurationSeconds(), run.getSizeBytes(), run.getArtifactRef(), run.getMessage());
    }
}
