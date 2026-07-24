package br.com.nexusit.incident;

import java.time.LocalDateTime;
import java.util.UUID;

public record CorrelatedIncidentResponse(
        UUID id,
        String correlationKey,
        String sourceType,
        String category,
        String title,
        String affectedHost,
        int severity,
        String status,
        LocalDateTime firstSeenAt,
        LocalDateTime lastSeenAt,
        int occurrenceCount,
        Integer openGlpiTicketId,
        String summary,
        String recommendation
) {
    public static CorrelatedIncidentResponse from(CorrelatedIncident i) {
        if (i == null) return null;
        return new CorrelatedIncidentResponse(i.getId(), i.getCorrelationKey(), i.getSourceType(), i.getCategory(), i.getTitle(),
                i.getAffectedHost(), i.getSeverity(), i.getStatus(), i.getFirstSeenAt(), i.getLastSeenAt(), i.getOccurrenceCount(),
                i.getOpenGlpiTicketId(), i.getSummary(), i.getRecommendation());
    }
}
