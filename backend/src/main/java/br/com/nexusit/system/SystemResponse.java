package br.com.nexusit.system;

import java.time.LocalDateTime;
import java.util.UUID;

public record SystemResponse(
        UUID id,
        String name,
        String url,
        String description,
        SystemCategory category,
        RefSummary server,
        RefSummary responsible,
        SystemStatus status,
        String documentation,
        LocalDateTime createdAt
) {
    public record RefSummary(UUID id, String name) {}

    public static SystemResponse from(SystemEntry e) {
        return new SystemResponse(
                e.getId(),
                e.getName(),
                e.getUrl(),
                e.getDescription(),
                e.getCategory(),
                e.getServer() != null ? new RefSummary(e.getServer().getId(), e.getServer().getName()) : null,
                e.getResponsible() != null ? new RefSummary(e.getResponsible().getId(), e.getResponsible().getName()) : null,
                e.getStatus(),
                e.getDocumentation(),
                e.getCreatedAt()
        );
    }
}
