package br.com.nexusit.wiki;

import java.time.LocalDateTime;
import java.util.UUID;

public record WikiResponse(UUID id, String title, String category, String content, String tags, String authorName, LocalDateTime createdAt, LocalDateTime updatedAt) {
    public static WikiResponse from(WikiArticle a) {
        return new WikiResponse(a.getId(), a.getTitle(), a.getCategory(), a.getContent(), a.getTags(),
                a.getAuthor() != null ? a.getAuthor().getName() : null, a.getCreatedAt(), a.getUpdatedAt());
    }
}
