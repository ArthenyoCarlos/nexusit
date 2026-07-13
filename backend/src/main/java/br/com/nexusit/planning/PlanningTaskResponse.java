package br.com.nexusit.planning;

import java.time.LocalDate;
import java.time.LocalDateTime;
import java.util.List;
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
        List<MemberRef> members,
        LocalDateTime createdAt,
        LocalDateTime updatedAt
) {
    public record MemberRef(UUID id, String name) {}

    public static PlanningTaskResponse from(PlanningTask t) {
        List<MemberRef> members = t.getMembers().stream()
                .map(m -> new MemberRef(m.getUser().getId(), m.getUser().getName()))
                .toList();
        return new PlanningTaskResponse(
                t.getId(), t.getTitle(), t.getDescription(),
                t.getColumnName(), t.getColumnOrder(), t.getDueDate(),
                t.getAssignee() != null ? t.getAssignee().getId() : null,
                t.getAssignee() != null ? t.getAssignee().getName() : null,
                members,
                t.getCreatedAt(), t.getUpdatedAt()
        );
    }
}
