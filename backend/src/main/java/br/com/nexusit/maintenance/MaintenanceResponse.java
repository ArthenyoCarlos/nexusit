package br.com.nexusit.maintenance;

import java.math.BigDecimal;
import java.time.LocalDate;
import java.time.LocalDateTime;
import java.util.UUID;

public record MaintenanceResponse(
        UUID id,
        String title,
        String description,
        LocalDate performedAt,
        BigDecimal cost,
        String performedBy,
        LocalDateTime createdAt
) {
    public static MaintenanceResponse from(MaintenanceRecord r) {
        return new MaintenanceResponse(
                r.getId(), r.getTitle(), r.getDescription(), r.getPerformedAt(),
                r.getCost(),
                r.getPerformedBy() != null ? r.getPerformedBy().getName() : null,
                r.getCreatedAt()
        );
    }
}
