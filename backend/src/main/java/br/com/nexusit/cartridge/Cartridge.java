package br.com.nexusit.cartridge;

import jakarta.persistence.*;
import lombok.*;

import java.time.LocalDateTime;
import java.util.UUID;

@Entity
@Table(name = "cartridges")
@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class Cartridge {

    @Id
    @GeneratedValue(strategy = GenerationType.UUID)
    private UUID id;

    @Column(nullable = false, unique = true, length = 20)
    private String code;

    @Column(nullable = false)
    private String model;

    @Column(name = "printer_model")
    private String printerModel;

    @Enumerated(EnumType.STRING)
    @Column(nullable = false, length = 20)
    private CartridgeStatus status;

    @Column(name = "current_sector")
    private String currentSector;

    @Column(name = "created_at", nullable = false, updatable = false)
    private LocalDateTime createdAt;

    @Column(name = "updated_at", nullable = false)
    private LocalDateTime updatedAt;

    @PrePersist
    void prePersist() {
        LocalDateTime now = LocalDateTime.now();
        if (createdAt == null) createdAt = now;
        updatedAt = now;
        if (status == null) status = CartridgeStatus.EM_ESTOQUE;
    }

    @PreUpdate
    void preUpdate() {
        updatedAt = LocalDateTime.now();
    }
}
