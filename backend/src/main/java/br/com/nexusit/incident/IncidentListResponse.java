package br.com.nexusit.incident;

import java.util.List;

public record IncidentListResponse(
        int openCount,
        int withTicketCount,
        int withoutTicketCount,
        List<CorrelatedIncidentResponse> incidents
) {}
