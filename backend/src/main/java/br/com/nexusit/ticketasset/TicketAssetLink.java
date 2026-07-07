package br.com.nexusit.ticketasset;

import br.com.nexusit.user.User;
import jakarta.persistence.*;
import lombok.*;

import java.time.LocalDateTime;
import java.util.UUID;

@Entity
@Table(name = "ticket_asset_links", uniqueConstraints = @UniqueConstraint(columnNames = {"glpi_ticket_id", "asset_type", "asset_id"}))
@Data @Builder @NoArgsConstructor @AllArgsConstructor
public class TicketAssetLink {

    @Id @GeneratedValue(strategy = GenerationType.UUID)
    private UUID id;

    @Column(name = "glpi_ticket_id", nullable = false)
    private Long glpiTicketId;

    @Enumerated(EnumType.STRING)
    @Column(name = "asset_type", nullable = false, length = 20)
    private TicketAssetType assetType;

    @Column(name = "asset_id", nullable = false)
    private UUID assetId;

    @Column(name = "asset_name", nullable = false)
    private String assetName;

    @Column(name = "asset_subtitle")
    private String assetSubtitle;

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
