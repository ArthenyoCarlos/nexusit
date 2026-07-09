package br.com.nexusit.nexusdesk;

import java.time.LocalDateTime;
import java.util.UUID;

public record NexusDeskDeviceResponse(
        UUID id,
        String name,
        String rustdeskId,
        boolean hasPassword,
        String notes,
        UUID inventoryItemId,
        String inventoryItemName,
        String createdBy,
        LocalDateTime createdAt
) {
    public static NexusDeskDeviceResponse from(NexusDeskDevice d) {
        return new NexusDeskDeviceResponse(
                d.getId(), d.getName(), d.getRustdeskId(),
                d.getEncryptedPassword() != null && !d.getEncryptedPassword().isBlank(),
                d.getNotes(),
                d.getInventoryItem() != null ? d.getInventoryItem().getId() : null,
                d.getInventoryItem() != null ? d.getInventoryItem().getName() : null,
                d.getCreatedBy() != null ? d.getCreatedBy().getName() : null,
                d.getCreatedAt()
        );
    }
}
