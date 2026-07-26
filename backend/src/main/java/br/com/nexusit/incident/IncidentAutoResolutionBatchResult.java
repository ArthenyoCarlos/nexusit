package br.com.nexusit.incident;

import java.util.List;

public record IncidentAutoResolutionBatchResult(
        long checked,
        long autoResolved,
        long active,
        long waitingStability,
        long skipped,
        List<IncidentAutoResolutionCheckResult> results
) {}
