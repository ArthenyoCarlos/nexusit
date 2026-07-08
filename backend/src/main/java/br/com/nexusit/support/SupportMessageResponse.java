package br.com.nexusit.support;

import java.time.LocalDateTime;
import java.util.UUID;

public record SupportMessageResponse(
        UUID id,
        String direction,
        String author,
        String authorName,
        String content,
        LocalDateTime createdAt,
        String mediaKind,
        String mediaFilename,
        String mediaMime,
        String mediaUrl,
        String transcription
) {
    public static SupportMessageResponse from(SupportMessage m) {
        String mediaUrl = m.getMediaBytes() != null && m.getMediaBytes().length > 0
                ? "/api/support/messages/" + m.getId() + "/media"
                : null;
        return new SupportMessageResponse(
                m.getId(),
                m.getDirection().name(),
                m.getAuthor().name(),
                m.getAuthorName(),
                m.getContent(),
                m.getCreatedAt(),
                m.getMediaKind(),
                m.getMediaFilename(),
                m.getMediaMime(),
                mediaUrl,
                m.getTranscription());
    }
}
