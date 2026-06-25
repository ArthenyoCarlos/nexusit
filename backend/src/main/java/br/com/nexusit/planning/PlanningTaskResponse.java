package br.com.nexusit.planning;

import java.time.LocalDate;
import java.time.LocalDateTime;
import java.util.UUID;

public record PlanningTaskResponse(
        UUID id,
        String title,
        String description,
        String columnName,
        int columnOrder,
        LocalDate dueDate,
        UUID assigneeId,
        String assigneeName,
        LocalDateTime createdAt,
        LocalDateTime updatedAt
) {
    public static PlanningTaskResponse from(PlanningTask t) {
        return new PlanningTaskResponse(
                t.getId(), t.getTitle(), t.getDescription(),
                t.getColumnName(), t.getColumnOrder(), t.getDueDate(),
                t.getAssignee() != null ? t.getAssignee().getId() : null,
                t.getAssignee() != null ? t.getAssignee().getName() : null,
                t.getCreatedAt(), t.getUpdatedAt()
        );
    }
}
