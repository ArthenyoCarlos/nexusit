package br.com.nexusit.incident;

import java.util.UUID;

public record IncidentAutoResolutionCheckResult(
        UUID incidentId,
        String title,
        CorrelatedIncidentResponse incident,
        IncidentAutoResolutionDecision decision,
        IncidentResolutionCheckResponse check
) {}
