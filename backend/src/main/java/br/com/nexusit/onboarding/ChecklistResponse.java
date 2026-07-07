package br.com.nexusit.onboarding;

import java.time.LocalDate;
import java.time.LocalDateTime;
import java.util.List;
import java.util.UUID;

public record ChecklistResponse(
        UUID id,
        String type,
        String employeeName,
        String department,
        LocalDate startDate,
        String notes,
        String status,
        LocalDateTime completedAt,
        UUID employeeUserId,
        String employeeUserName,
        UUID inventoryItemId,
        String inventoryItemName,
        String createdBy,
        int totalItems,
        int doneItems,
        List<ItemResponse> items,
        LocalDateTime createdAt
) {
    public record ItemResponse(UUID id, String title, String description, int itemOrder,
                               LocalDate dueDate, UUID assignedToId, String assignedToName,
                               boolean done, LocalDateTime doneAt, String doneBy) {}

    public static ChecklistResponse from(Checklist c) {
        List<ItemResponse> items = c.getItems() == null ? List.of() :
                c.getItems().stream().map(i -> new ItemResponse(
                        i.getId(), i.getTitle(), i.getDescription(),
                        i.getItemOrder() != null ? i.getItemOrder() : 0,
                        i.getDueDate(),
                        i.getAssignedTo() != null ? i.getAssignedTo().getId() : null,
                        i.getAssignedTo() != null ? i.getAssignedTo().getName() : null,
                        Boolean.TRUE.equals(i.getDone()), i.getDoneAt(),
                        i.getDoneBy() != null ? i.getDoneBy().getName() : null
                )).toList();
        int done = (int) items.stream().filter(ItemResponse::done).count();
        return new ChecklistResponse(
                c.getId(), c.getType(), c.getEmployeeName(), c.getDepartment(),
                c.getStartDate(), c.getNotes(),
                c.getStatus() != null ? c.getStatus().name() : null,
                c.getCompletedAt(),
                c.getEmployeeUser() != null ? c.getEmployeeUser().getId() : null,
                c.getEmployeeUser() != null ? c.getEmployeeUser().getName() : null,
                c.getInventoryItem() != null ? c.getInventoryItem().getId() : null,
                c.getInventoryItem() != null ? c.getInventoryItem().getName() : null,
                c.getCreatedBy() != null ? c.getCreatedBy().getName() : null,
                items.size(), done, items, c.getCreatedAt()
        );
    }
}
