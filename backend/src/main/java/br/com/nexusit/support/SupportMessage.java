package br.com.nexusit.support;

import jakarta.persistence.*;
import lombok.*;

import java.time.LocalDateTime;
import java.util.UUID;

@Entity
@Table(name = "support_messages")
@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class SupportMessage {

    @Id
    @GeneratedValue(strategy = GenerationType.UUID)
    private UUID id;

    @ManyToOne(fetch = FetchType.LAZY, optional = false)
    @JoinColumn(name = "conversation_id", nullable = false)
    private SupportConversation conversation;

    @Enumerated(EnumType.STRING)
    @Column(nullable = false, length = 3)
    private MessageDirection direction;

    @Enumerated(EnumType.STRING)
    @Column(nullable = false, length = 10)
    private MessageAuthor author;

    @Column(name = "author_name")
    private String authorName;

    @Column(columnDefinition = "TEXT")
    private String content;

    @Column(name = "media_bytes", columnDefinition = "BYTEA")
    private byte[] mediaBytes;

    @Column(name = "media_filename")
    private String mediaFilename;

    @Column(name = "media_mime", length = 128)
    private String mediaMime;

    @Column(name = "media_kind", length = 32)
    private String mediaKind;

    @Column(columnDefinition = "TEXT")
    private String transcription;

    @Column(name = "created_at", nullable = false, updatable = false)
    private LocalDateTime createdAt;

    @PrePersist
    void prePersist() { if (createdAt == null) createdAt = LocalDateTime.now(); }
}
