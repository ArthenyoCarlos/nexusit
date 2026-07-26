package br.com.nexusit.incident;

import java.util.List;
import java.util.UUID;

public record IncidentRunbookResponse(
        UUID incidentId,
        String category,
        String recommendedAction,
        String impact,
        List<IncidentRunbookStepResponse> steps,
        List<IncidentActionResultResponse> recentResults
) {}
