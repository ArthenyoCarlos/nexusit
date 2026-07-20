package br.com.nexusit.broadcast;

import java.time.LocalDateTime;
import java.util.UUID;

public record BroadcastGroup(UUID id, String name, String groupJid, LocalDateTime createdAt) {
    public static BroadcastGroup from(NotificationGroup g) {
        return new BroadcastGroup(g.getId(), g.getName(), g.getGroupJid(), g.getCreatedAt());
    }
}
