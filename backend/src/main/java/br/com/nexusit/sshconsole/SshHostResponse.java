package br.com.nexusit.sshconsole;

import java.time.LocalDateTime;
import java.util.UUID;

public record SshHostResponse(
        UUID id,
        String name,
        String host,
        Integer port,
        String username,
        SshAuthType authType,
        String description,
        UUID inventoryItemId,
        String inventoryItemName,
        boolean hostKeyTrusted,
        String hostKeyFingerprint,
        boolean hasCredential,
        String createdBy,
        LocalDateTime createdAt
) {
    public static SshHostResponse from(SshHost h) {
        SshAuthType authType = h.getAuthType() != null ? h.getAuthType() : SshAuthType.PASSWORD;
        boolean hasCredential = authType == SshAuthType.PRIVATE_KEY
                ? h.getEncryptedPrivateKey() != null && !h.getEncryptedPrivateKey().isBlank()
                : h.getEncryptedPassword() != null && !h.getEncryptedPassword().isBlank();
        return new SshHostResponse(
                h.getId(), h.getName(), h.getHost(), h.getPort(), h.getUsername(), authType, h.getDescription(),
                h.getInventoryItem() != null ? h.getInventoryItem().getId() : null,
                h.getInventoryItem() != null ? h.getInventoryItem().getName() : null,
                h.getHostKeyFingerprint() != null,
                h.getHostKeyFingerprint(),
                hasCredential,
                h.getCreatedBy() != null ? h.getCreatedBy().getName() : null,
                h.getCreatedAt()
        );
    }
}
