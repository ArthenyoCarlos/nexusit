package br.com.nexusit.audit;

import java.time.LocalDateTime;
import java.util.UUID;

public record AuditEventResponse(
        UUID id,
        String module,
        String action,
        UUID actorId,
        String actorName,
        String targetType,
        UUID targetId,
        String targetLabel,
        String details,
        LocalDateTime createdAt
) {
    public static AuditEventResponse from(AuditEvent e) {
        return new AuditEventResponse(
                e.getId(), e.getModule().name(), e.getAction(),
                e.getActor() != null ? e.getActor().getId() : null,
                e.getActorName(),
                e.getTargetType(), e.getTargetId(), e.getTargetLabel(),
                e.getDetails(), e.getCreatedAt()
        );
    }
}
