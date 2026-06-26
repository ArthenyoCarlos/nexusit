package br.com.nexusit.onboarding;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;

import java.time.LocalDate;
import java.util.List;

public record ChecklistRequest(
        @NotBlank String type,
        @NotBlank String employeeName,
        String department,
        LocalDate startDate,
        String notes,
        @NotNull List<ItemRequest> items
) {
    public record ItemRequest(String title, String description, Integer itemOrder) {}
}
