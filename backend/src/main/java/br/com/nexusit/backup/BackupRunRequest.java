package br.com.nexusit.backup;

import java.time.LocalDateTime;

public record BackupRunRequest(String status, LocalDateTime startedAt, LocalDateTime finishedAt, Integer durationSeconds, Long sizeBytes, String artifactRef, String message) {}
