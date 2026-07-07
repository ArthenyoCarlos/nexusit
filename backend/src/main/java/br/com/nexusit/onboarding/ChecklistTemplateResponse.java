package br.com.nexusit.onboarding;

import java.util.List;
import java.util.UUID;

public record ChecklistTemplateResponse(
        UUID id,
        String type,
        String name,
        boolean active,
        List<ItemResponse> items
) {
    public record ItemResponse(UUID id, String title, String description, int itemOrder) {}

    public static ChecklistTemplateResponse from(ChecklistTemplate t) {
        List<ItemResponse> items = t.getItems() == null ? List.of() :
                t.getItems().stream().map(i -> new ItemResponse(
                        i.getId(), i.getTitle(), i.getDescription(),
                        i.getItemOrder() != null ? i.getItemOrder() : 0
                )).toList();
        return new ChecklistTemplateResponse(
                t.getId(), t.getType(), t.getName(), Boolean.TRUE.equals(t.getActive()), items
        );
    }
}
