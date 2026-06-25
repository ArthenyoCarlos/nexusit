package br.com.nexusit.system;

import br.com.nexusit.inventory.InventoryItem;
import br.com.nexusit.user.User;
import jakarta.persistence.*;
import lombok.*;

import java.time.LocalDateTime;
import java.util.UUID;

@Entity
@Table(name = "systems")
@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class SystemEntry {

    @Id
    @GeneratedValue(strategy = GenerationType.UUID)
    private UUID id;

    @Column(nullable = false)
    private String name;

    @Column(length = 500)
    private String url;

    @Column(columnDefinition = "TEXT")
    private String description;

    @Enumerated(EnumType.STRING)
    @Column(nullable = false)
    @Builder.Default
    private SystemCategory category = SystemCategory.OUTRO;

    @ManyToOne(fetch = FetchType.LAZY, optional = true)
    @JoinColumn(name = "server_id")
    private InventoryItem server;

    @ManyToOne(fetch = FetchType.LAZY, optional = true)
    @JoinColumn(name = "responsible_id")
    private User responsible;

    @Enumerated(EnumType.STRING)
    @Column(nullable = false)
    @Builder.Default
    private SystemStatus status = SystemStatus.ACTIVE;

    @Column(columnDefinition = "TEXT")
    private String documentation;

    @Column(name = "created_at", nullable = false, updatable = false)
    private LocalDateTime createdAt;

    @PrePersist
    void prePersist() {
        if (createdAt == null) createdAt = LocalDateTime.now();
    }
}
