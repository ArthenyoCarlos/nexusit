package br.com.nexusit.incident;

import java.util.List;

public record IncidentDetailResponse(
        CorrelatedIncidentResponse incident,
        List<CorrelatedIncidentEventResponse> events,
        String analysis
) {}
