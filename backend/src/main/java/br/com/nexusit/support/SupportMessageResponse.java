package br.com.nexusit.support;

import java.time.LocalDateTime;
import java.util.UUID;

public record SupportMessageResponse(
        UUID id, String direction, String author, String authorName, String content, LocalDateTime createdAt
) {
    public static SupportMessageResponse from(SupportMessage m) {
        return new SupportMessageResponse(
                m.getId(), m.getDirection().name(), m.getAuthor().name(), m.getAuthorName(), m.getContent(), m.getCreatedAt());
    }
}
