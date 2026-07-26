package br.com.nexusit.incident;

import java.time.LocalDateTime;
import java.util.UUID;

public record IncidentResolutionCheckResponse(
        UUID id,
        UUID incidentId,
        String status,
        String reason,
        int minutesStable,
        boolean activeSourcePresent,
        LocalDateTime checkedAt
) {
    public static IncidentResolutionCheckResponse from(IncidentResolutionCheck c) {
        if (c == null) return null;
        return new IncidentResolutionCheckResponse(c.getId(), c.getIncident().getId(), c.getStatus(), c.getReason(), c.getMinutesStable(), c.isActiveSourcePresent(), c.getCheckedAt());
    }
}
