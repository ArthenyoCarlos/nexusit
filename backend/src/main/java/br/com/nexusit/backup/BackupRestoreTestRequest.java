package br.com.nexusit.backup;

import java.time.LocalDateTime;

public record BackupRestoreTestRequest(String status, LocalDateTime testedAt, Integer durationSeconds, String testedArtifactRef, String message, String validatedBy) {}
