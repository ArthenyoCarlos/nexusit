package br.com.nexusit.incident;

import java.util.List;

public record IncidentListResponse(
        long totalCount,
        long openCount,
        long resolvedCount,
        long withTicketCount,
        long withoutTicketCount,
        long criticalCount,
        long recurrentCount,
        List<CorrelatedIncidentResponse> incidents
) {}
