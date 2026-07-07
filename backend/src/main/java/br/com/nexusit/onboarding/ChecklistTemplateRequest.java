package br.com.nexusit.onboarding;

import jakarta.validation.constraints.NotBlank;

import java.util.List;

public record ChecklistTemplateRequest(
        @NotBlank String type,
        @NotBlank String name,
        Boolean active,
        List<ItemRequest> items
) {
    public record ItemRequest(String title, String description, Integer itemOrder) {}
}
