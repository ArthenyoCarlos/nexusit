package br.com.nexusit.notes;

import java.time.LocalDateTime;
import java.util.List;
import java.util.UUID;

public record NoteResponse(
        UUID id,
        String title,
        String content,
        String visibility,
        UUID authorId,
        String authorName,
        List<TagInfo> tags,
        LocalDateTime createdAt,
        LocalDateTime updatedAt
) {
    public record TagInfo(String tag, String category) {}

    public static NoteResponse from(Note note) {
        List<TagInfo> tags = note.getTags().stream()
                .map(t -> new TagInfo(t.getTag(), t.getCategory()))
                .toList();
        return new NoteResponse(
                note.getId(),
                note.getTitle(),
                note.getContent(),
                note.getVisibility().name(),
                note.getAuthor().getId(),
                note.getAuthor().getName(),
                tags,
                note.getCreatedAt(),
                note.getUpdatedAt()
        );
    }
}
