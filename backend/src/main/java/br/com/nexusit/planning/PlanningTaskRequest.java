package br.com.nexusit.planning;

import jakarta.validation.constraints.NotBlank;

import java.time.LocalDate;
import java.util.List;
import java.util.UUID;

public record PlanningTaskRequest(
        @NotBlank String title,
        String description,
        String columnName,
        Integer columnOrder,
        LocalDate dueDate,
        UUID assigneeId,
        List<UUID> memberIds
) {}
