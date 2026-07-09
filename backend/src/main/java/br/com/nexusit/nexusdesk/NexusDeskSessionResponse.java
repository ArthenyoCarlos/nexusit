package br.com.nexusit.nexusdesk;

import java.time.LocalDateTime;
import java.util.UUID;

public record NexusDeskSessionResponse(
        UUID id,
        UUID deviceId,
        String deviceName,
        String userName,
        Integer glpiTicketId,
        LocalDateTime startedAt
) {
    public static NexusDeskSessionResponse from(NexusDeskSession s) {
        return new NexusDeskSessionResponse(
                s.getId(),
                s.getDevice().getId(),
                s.getDevice().getName(),
                s.getUser().getName(),
                s.getGlpiTicketId(),
                s.getStartedAt()
        );
    }
}
