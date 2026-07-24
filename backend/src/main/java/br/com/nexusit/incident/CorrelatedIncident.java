package br.com.nexusit.incident;

import jakarta.persistence.*;
import lombok.*;

import java.time.LocalDateTime;
import java.util.UUID;

@Entity
@Table(name = "correlated_incidents")
@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class CorrelatedIncident {
    @Id
    @GeneratedValue(strategy = GenerationType.UUID)
    private UUID id;

    @Column(name = "correlation_key", nullable = false, unique = true, length = 500)
    private String correlationKey;

    @Column(name = "source_type", nullable = false, length = 40)
    private String sourceType;

    @Column(nullable = false, length = 80)
    private String category;

    @Column(nullable = false, length = 500)
    private String title;

    @Column(name = "affected_host")
    private String affectedHost;

    @Column(nullable = false)
    private int severity;

    @Column(nullable = false, length = 40)
    private String status;

    @Column(name = "first_seen_at", nullable = false)
    private LocalDateTime firstSeenAt;

    @Column(name = "last_seen_at", nullable = false)
    private LocalDateTime lastSeenAt;

    @Column(name = "occurrence_count", nullable = false)
    private int occurrenceCount;

    @Column(name = "last_source_event_id")
    private String lastSourceEventId;

    @Column(name = "open_glpi_ticket_id")
    private Integer openGlpiTicketId;

    @Column(columnDefinition = "TEXT")
    private String summary;

    @Column(columnDefinition = "TEXT")
    private String recommendation;

    @Column(name = "created_at", nullable = false, updatable = false)
    private LocalDateTime createdAt;

    @Column(name = "updated_at", nullable = false)
    private LocalDateTime updatedAt;

    @PrePersist
    void prePersist() {
        LocalDateTime now = LocalDateTime.now();
        if (status == null) status = "OPEN";
        if (firstSeenAt == null) firstSeenAt = now;
        if (lastSeenAt == null) lastSeenAt = now;
        if (occurrenceCount <= 0) occurrenceCount = 1;
        if (createdAt == null) createdAt = now;
        updatedAt = now;
    }

    @PreUpdate
    void preUpdate() { updatedAt = LocalDateTime.now(); }
}
