package br.com.nexusit.onboarding;

import jakarta.validation.constraints.NotBlank;

import java.time.LocalDate;
import java.util.List;
import java.util.UUID;

public record ChecklistRequest(
        @NotBlank String type,
        @NotBlank String employeeName,
        String department,
        LocalDate startDate,
        String notes,
        UUID templateId,
        UUID employeeUserId,
        UUID inventoryItemId,
        List<ItemRequest> items
) {
    public record ItemRequest(String title, String description, Integer itemOrder, LocalDate dueDate, UUID assignedToId) {}
}
