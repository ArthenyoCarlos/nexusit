package br.com.nexusit.sshconsole;

import br.com.nexusit.inventory.InventoryItem;
import br.com.nexusit.user.User;
import jakarta.persistence.*;
import lombok.*;

import java.time.LocalDateTime;
import java.util.UUID;

@Entity
@Table(name = "ssh_hosts")
@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class SshHost {

    @Id
    @GeneratedValue(strategy = GenerationType.UUID)
    private UUID id;

    @Column(nullable = false)
    private String name;

    @Column(nullable = false)
    private String host;

    @Column(nullable = false)
    @Builder.Default
    private Integer port = 22;

    @Column(nullable = false)
    private String username;

    @Enumerated(EnumType.STRING)
    @Column(name = "auth_type", nullable = false, length = 30)
    @Builder.Default
    private SshAuthType authType = SshAuthType.PASSWORD;

    @Column(name = "encrypted_password", columnDefinition = "TEXT")
    private String encryptedPassword;

    @Column(name = "encrypted_private_key", columnDefinition = "TEXT")
    private String encryptedPrivateKey;

    @Column(name = "encrypted_private_key_passphrase", columnDefinition = "TEXT")
    private String encryptedPrivateKeyPassphrase;

    @Column(name = "host_key_fingerprint", length = 128)
    private String hostKeyFingerprint;

    @Column(columnDefinition = "TEXT")
    private String description;

    @ManyToOne(fetch = FetchType.LAZY, optional = true)
    @JoinColumn(name = "inventory_item_id")
    private InventoryItem inventoryItem;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "created_by")
    private User createdBy;

    @Column(name = "created_at", nullable = false, updatable = false)
    private LocalDateTime createdAt;

    @Column(name = "updated_at", nullable = false)
    private LocalDateTime updatedAt;

    @PrePersist
    void prePersist() {
        if (createdAt == null) createdAt = LocalDateTime.now();
        if (authType == null) authType = SshAuthType.PASSWORD;
        updatedAt = LocalDateTime.now();
    }

    @PreUpdate
    void preUpdate() {
        if (authType == null) authType = SshAuthType.PASSWORD;
        updatedAt = LocalDateTime.now();
    }
}
