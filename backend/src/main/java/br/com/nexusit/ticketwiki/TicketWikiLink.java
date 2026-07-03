package br.com.nexusit.ticketwiki;

import br.com.nexusit.user.User;
import br.com.nexusit.wiki.WikiArticle;
import jakarta.persistence.*;
import lombok.*;

import java.time.LocalDateTime;
import java.util.UUID;

@Entity
@Table(name = "ticket_wiki_links", uniqueConstraints = @UniqueConstraint(columnNames = {"glpi_ticket_id", "wiki_article_id"}))
@Data @Builder @NoArgsConstructor @AllArgsConstructor
public class TicketWikiLink {
    @Id @GeneratedValue(strategy = GenerationType.UUID)
    private UUID id;

    @Column(name = "glpi_ticket_id", nullable = false)
    private Long glpiTicketId;

    @ManyToOne(fetch = FetchType.LAZY, optional = false)
    @JoinColumn(name = "wiki_article_id", nullable = false)
    private WikiArticle wikiArticle;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "created_by")
    private User createdBy;

    @Column(name = "created_at", nullable = false, updatable = false)
    private LocalDateTime createdAt;

    @PrePersist
    void prePersist() {
        if (createdAt == null) createdAt = LocalDateTime.now();
    }
}
