package br.com.nexusit.onboarding;

import java.time.LocalDate;
import java.util.UUID;

public record ChecklistUpdateRequest(
        String employeeName,
        String department,
        LocalDate startDate,
        String notes,
        String status,
        UUID employeeUserId,
        UUID inventoryItemId
) {}
