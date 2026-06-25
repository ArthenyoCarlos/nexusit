package br.com.nexusit.networkdoc;

import java.time.OffsetDateTime;
import java.util.UUID;

public record NetworkDocResponse(
        UUID id,
        String title,
        String section,
        String content,
        String updatedByName,
        OffsetDateTime updatedAt
) {
    public static NetworkDocResponse from(NetworkDoc doc) {
        return new NetworkDocResponse(
                doc.getId(),
                doc.getTitle(),
                doc.getSection(),
                doc.getContent(),
                doc.getUpdatedBy() != null ? doc.getUpdatedBy().getName() : null,
                doc.getUpdatedAt()
        );
    }
}
