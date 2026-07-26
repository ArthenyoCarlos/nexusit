package br.com.nexusit.incident;

import java.util.List;

public record IncidentAutoResolutionSummary(
        CorrelatedIncidentResponse incident,
        IncidentResolutionCheckResponse latestCheck,
        List<IncidentResolutionCheckResponse> recentChecks
) {}
