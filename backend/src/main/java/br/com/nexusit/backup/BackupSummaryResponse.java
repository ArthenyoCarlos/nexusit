package br.com.nexusit.backup;

import java.util.List;

public record BackupSummaryResponse(
        long totalJobs,
        long okCount,
        long failedCount,
        long staleCount,
        long noRunCount,
        long restoreOkCount,
        long restoreProblemCount,
        long queuedRequestCount,
        List<BackupJobResponse> jobs
) {}
