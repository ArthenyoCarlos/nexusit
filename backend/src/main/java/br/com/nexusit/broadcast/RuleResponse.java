package br.com.nexusit.broadcast;

import java.time.LocalDateTime;
import java.util.UUID;

public record RuleResponse(
        UUID id,
        String name,
        String hostId,
        String hostName,
        String message,
        TargetType targetType,
        UUID targetId,
        String targetLabel,
        RuleMode mode,
        boolean active,
        int cooldownMinutes,
        LocalDateTime lastTriggeredAt,
        String createdByName,
        LocalDateTime createdAt
) {
    public static RuleResponse from(NotificationRule r) {
        return new RuleResponse(
                r.getId(), r.getName(), r.getHostId(), r.getHostName(), r.getMessage(),
                r.getTargetType(), r.getTargetId(), r.getTargetLabel(),
                r.getMode(), r.isActive(), r.getCooldownMinutes(),
                r.getLastTriggeredAt(), r.getCreatedByName(), r.getCreatedAt()
        );
    }
}
