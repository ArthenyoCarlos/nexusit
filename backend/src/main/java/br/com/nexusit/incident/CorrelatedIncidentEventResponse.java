package br.com.nexusit.incident;

import java.time.LocalDateTime;
import java.util.Map;
import java.util.UUID;

public record CorrelatedIncidentEventResponse(
        UUID id,
        String sourceType,
        String sourceEventId,
        String eventType,
        int severity,
        String message,
        Map<String, Object> payload,
        LocalDateTime observedAt
) {
    public static CorrelatedIncidentEventResponse from(CorrelatedIncidentEvent e) {
        return new CorrelatedIncidentEventResponse(e.getId(), e.getSourceType(), e.getSourceEventId(), e.getEventType(), e.getSeverity(),
                e.getMessage(), e.getPayload(), e.getObservedAt());
    }
}
