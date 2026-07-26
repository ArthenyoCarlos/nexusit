package br.com.nexusit.backup;

import java.time.LocalDateTime;
import java.util.UUID;

public record BackupActionRequestResponse(UUID id, UUID jobId, String action, String status, String requestedBy, LocalDateTime requestedAt, LocalDateTime startedAt, LocalDateTime finishedAt, String resultMessage) {
    public static BackupActionRequestResponse from(BackupActionRequest r) {
        return new BackupActionRequestResponse(r.getId(), r.getJob().getId(), r.getAction(), r.getStatus(), r.getRequestedBy(), r.getRequestedAt(), r.getStartedAt(), r.getFinishedAt(), r.getResultMessage());
    }
}
