package br.com.nexusit.backup;

import java.time.LocalDateTime;
import java.util.UUID;

public record BackupRestoreTestResponse(UUID id, UUID jobId, String status, LocalDateTime testedAt, Integer durationSeconds, String testedArtifactRef, String message, String validatedBy) {
    public static BackupRestoreTestResponse from(BackupRestoreTest t) {
        if (t == null) return null;
        return new BackupRestoreTestResponse(t.getId(), t.getJob().getId(), t.getStatus(), t.getTestedAt(), t.getDurationSeconds(), t.getTestedArtifactRef(), t.getMessage(), t.getValidatedBy());
    }
}
