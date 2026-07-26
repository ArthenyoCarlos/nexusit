package br.com.nexusit.backup;

import java.util.List;

public record BackupSummaryResponse(long totalJobs, long okCount, long failedCount, long staleCount, long noRunCount, List<BackupJobResponse> jobs) {}
