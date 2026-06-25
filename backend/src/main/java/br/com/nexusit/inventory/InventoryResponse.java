package br.com.nexusit.inventory;

import java.time.LocalDate;
import java.time.LocalDateTime;
import java.util.UUID;

public record InventoryResponse(
        UUID id,
        String name,
        ItemType type,
        String brand,
        String model,
        String serialNumber,
        String location,
        ResponsibleSummary responsible,
        LocalDate purchaseDate,
        ItemStatus status,
        String notes,
        LocalDateTime createdAt
) {
    public record ResponsibleSummary(UUID id, String name) {}

    public static InventoryResponse from(InventoryItem item) {
        return new InventoryResponse(
                item.getId(),
                item.getName(),
                item.getType(),
                item.getBrand(),
                item.getModel(),
                item.getSerialNumber(),
                item.getLocation(),
                item.getResponsible() != null
                        ? new ResponsibleSummary(item.getResponsible().getId(), item.getResponsible().getName())
                        : null,
                item.getPurchaseDate(),
                item.getStatus(),
                item.getNotes(),
                item.getCreatedAt()
        );
    }
}
