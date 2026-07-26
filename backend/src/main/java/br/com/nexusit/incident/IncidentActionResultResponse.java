package br.com.nexusit.incident;

import java.time.LocalDateTime;
import java.util.UUID;

public record IncidentActionResultResponse(
        UUID id,
        UUID incidentId,
        String actionKey,
        String status,
        String title,
        String summary,
        String output,
        String executedBy,
        LocalDateTime executedAt,
        Long durationMs
) {
    public static IncidentActionResultResponse from(IncidentActionResult r) {
        return new IncidentActionResultResponse(r.getId(), r.getIncident().getId(), r.getActionKey(), r.getStatus(), r.getTitle(), r.getSummary(), r.getOutput(), r.getExecutedBy(), r.getExecutedAt(), r.getDurationMs());
    }
}
