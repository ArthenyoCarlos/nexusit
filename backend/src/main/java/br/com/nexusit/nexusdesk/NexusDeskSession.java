package br.com.nexusit.nexusdesk;

import br.com.nexusit.user.User;
import jakarta.persistence.*;
import lombok.*;

import java.time.LocalDateTime;
import java.util.UUID;

@Entity
@Table(name = "nexusdesk_sessions")
@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class NexusDeskSession {

    @Id
    @GeneratedValue(strategy = GenerationType.UUID)
    private UUID id;

    @ManyToOne(fetch = FetchType.LAZY, optional = false)
    @JoinColumn(name = "device_id", nullable = false)
    private NexusDeskDevice device;

    @ManyToOne(fetch = FetchType.LAZY, optional = false)
    @JoinColumn(name = "user_id", nullable = false)
    private User user;

    @Column(name = "glpi_ticket_id")
    private Integer glpiTicketId;

    @Column(name = "started_at", nullable = false, updatable = false)
    private LocalDateTime startedAt;

    @PrePersist
    void prePersist() {
        if (startedAt == null) startedAt = LocalDateTime.now();
    }
}
