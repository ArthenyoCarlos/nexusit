package br.com.nexusit.onboarding;

import java.time.LocalDate;
import java.util.UUID;

public record ChecklistItemUpdateRequest(
        String title,
        String description,
        LocalDate dueDate,
        UUID assignedToId
) {}
