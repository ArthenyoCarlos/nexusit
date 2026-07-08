package br.com.nexusit.support;

import jakarta.persistence.*;
import lombok.*;

import java.time.LocalDateTime;
import java.util.UUID;

@Entity
@Table(name = "whatsapp_contacts")
@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class WhatsappContact {

    @Id
    @GeneratedValue(strategy = GenerationType.UUID)
    private UUID id;

    @Column(name = "phone_number", nullable = false, unique = true, length = 32)
    private String phoneNumber;

    @Column(name = "display_name")
    private String displayName;

    @Column(name = "glpi_user_id")
    private Integer glpiUserId;

    @Column(name = "glpi_user_name")
    private String glpiUserName;

    @Column(name = "created_at", nullable = false, updatable = false)
    private LocalDateTime createdAt;

    @PrePersist
    void prePersist() { if (createdAt == null) createdAt = LocalDateTime.now(); }
}
