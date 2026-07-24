package br.com.nexusit.incident;

import jakarta.persistence.*;
import lombok.*;
import org.hibernate.annotations.JdbcTypeCode;
import org.hibernate.type.SqlTypes;

import java.time.LocalDateTime;
import java.util.Map;
import java.util.UUID;

@Entity
@Table(name = "correlated_incident_events")
@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class CorrelatedIncidentEvent {
    @Id
    @GeneratedValue(strategy = GenerationType.UUID)
    private UUID id;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "incident_id", nullable = false)
    private CorrelatedIncident incident;

    @Column(name = "source_type", nullable = false, length = 40)
    private String sourceType;

    @Column(name = "source_event_id")
    private String sourceEventId;

    @Column(name = "event_type", nullable = false, length = 80)
    private String eventType;

    @Column(nullable = false)
    private int severity;

    @Column(nullable = false, columnDefinition = "TEXT")
    private String message;

    @JdbcTypeCode(SqlTypes.JSON)
    @Column(columnDefinition = "jsonb")
    private Map<String, Object> payload;

    @Column(name = "observed_at", nullable = false)
    private LocalDateTime observedAt;

    @Column(name = "created_at", nullable = false, updatable = false)
    private LocalDateTime createdAt;

    @PrePersist
    void prePersist() {
        LocalDateTime now = LocalDateTime.now();
        if (observedAt == null) observedAt = now;
        if (createdAt == null) createdAt = now;
    }
}
