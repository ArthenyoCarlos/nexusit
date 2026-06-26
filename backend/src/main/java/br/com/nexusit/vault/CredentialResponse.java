package br.com.nexusit.vault;

import java.time.LocalDateTime;
import java.util.UUID;

public record CredentialResponse(
        UUID id,
        String title,
        String type,
        String username,
        String url,
        String description,
        String tags,
        String createdBy,
        LocalDateTime createdAt,
        LocalDateTime updatedAt
) {
    public static CredentialResponse from(Credential c) {
        return new CredentialResponse(
                c.getId(), c.getTitle(), c.getType(), c.getUsername(),
                c.getUrl(), c.getDescription(), c.getTags(),
                c.getCreatedBy() != null ? c.getCreatedBy().getName() : null,
                c.getCreatedAt(), c.getUpdatedAt()
        );
    }
}
