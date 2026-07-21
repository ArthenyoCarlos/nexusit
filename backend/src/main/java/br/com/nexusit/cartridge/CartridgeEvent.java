package br.com.nexusit.cartridge;

import jakarta.persistence.*;
import lombok.*;

import java.time.LocalDateTime;
import java.util.UUID;

@Entity
@Table(name = "cartridge_events")
@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class CartridgeEvent {

    @Id
    @GeneratedValue(strategy = GenerationType.UUID)
    private UUID id;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "cartridge_id", nullable = false)
    private Cartridge cartridge;

    @Enumerated(EnumType.STRING)
    @Column(nullable = false, length = 30)
    private CartridgeEventType type;

    private String sector;

    @Column(columnDefinition = "TEXT")
    private String notes;

    @Column(name = "performed_by_name")
    private String performedByName;

    @Column(name = "created_at", nullable = false, updatable = false)
    private LocalDateTime createdAt;

    @PrePersist
    void prePersist() {
        if (createdAt == null) createdAt = LocalDateTime.now();
    }
}
