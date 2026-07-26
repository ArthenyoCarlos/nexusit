package br.com.nexusit.incident;

import jakarta.persistence.*;
import lombok.*;

import java.time.LocalDateTime;
import java.util.UUID;

@Entity
@Table(name = "incident_resolution_checks")
@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class IncidentResolutionCheck {
    @Id
    @GeneratedValue(strategy = GenerationType.UUID)
    private UUID id;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "incident_id", nullable = false)
    private CorrelatedIncident incident;

    @Column(nullable = false, length = 40)
    private String status;

    @Column(nullable = false, columnDefinition = "TEXT")
    private String reason;

    @Column(name = "minutes_stable", nullable = false)
    private int minutesStable;

    @Column(name = "active_source_present", nullable = false)
    private boolean activeSourcePresent;

    @Column(name = "checked_at", nullable = false)
    private LocalDateTime checkedAt;

    @Column(name = "created_at", nullable = false, updatable = false)
    private LocalDateTime createdAt;

    @PrePersist
    void prePersist() {
        LocalDateTime now = LocalDateTime.now();
        if (checkedAt == null) checkedAt = now;
        if (createdAt == null) createdAt = now;
    }
}
