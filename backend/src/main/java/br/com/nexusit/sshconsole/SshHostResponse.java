package br.com.nexusit.sshconsole;

import java.time.LocalDateTime;
import java.util.UUID;

public record SshHostResponse(
        UUID id,
        String name,
        String host,
        Integer port,
        String username,
        String description,
        UUID inventoryItemId,
        String inventoryItemName,
        boolean hostKeyTrusted,
        String hostKeyFingerprint,
        String createdBy,
        LocalDateTime createdAt
) {
    public static SshHostResponse from(SshHost h) {
        return new SshHostResponse(
                h.getId(), h.getName(), h.getHost(), h.getPort(), h.getUsername(), h.getDescription(),
                h.getInventoryItem() != null ? h.getInventoryItem().getId() : null,
                h.getInventoryItem() != null ? h.getInventoryItem().getName() : null,
                h.getHostKeyFingerprint() != null,
                h.getHostKeyFingerprint(),
                h.getCreatedBy() != null ? h.getCreatedBy().getName() : null,
                h.getCreatedAt()
        );
    }
}
