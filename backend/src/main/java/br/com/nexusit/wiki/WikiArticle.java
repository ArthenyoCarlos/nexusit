package br.com.nexusit.wiki;

import br.com.nexusit.user.User;
import jakarta.persistence.*;
import lombok.*;
import java.time.LocalDateTime;
import java.util.UUID;

@Entity @Table(name = "wiki_articles") @Data @Builder @NoArgsConstructor @AllArgsConstructor
public class WikiArticle {
    @Id @GeneratedValue(strategy = GenerationType.UUID)
    private UUID id;
    @Column(nullable = false) private String title;
    @Column(nullable = false) private String category;
    @Column(columnDefinition = "TEXT", nullable = false) private String content;
    private String tags;
    @ManyToOne(fetch = FetchType.LAZY) @JoinColumn(name = "author_id") private User author;
    @Column(nullable = false) private LocalDateTime createdAt;
    @Column(nullable = false) private LocalDateTime updatedAt;

    @PrePersist void pre() { createdAt = updatedAt = LocalDateTime.now(); }
    @PreUpdate  void upd() { updatedAt = LocalDateTime.now(); }
}
