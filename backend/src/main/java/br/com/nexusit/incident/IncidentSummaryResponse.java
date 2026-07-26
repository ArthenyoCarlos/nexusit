package br.com.nexusit.incident;

public record IncidentSummaryResponse(
        long totalCount,
        long openCount,
        long resolvedCount,
        long withTicketCount,
        long withoutTicketCount,
        long criticalCount,
        long recurrentCount
) {}
