package br.com.nexusit.alerttriage;

import br.com.nexusit.user.User;
import jakarta.persistence.*;
import lombok.*;

import java.time.LocalDateTime;
import java.util.UUID;

@Entity
@Table(name = "alert_triage_rules")
@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class AlertTriageRule {
    @Id
    @GeneratedValue(strategy = GenerationType.UUID)
    private UUID id;

    @Column(name = "host_pattern")
    private String hostPattern;

    @Column(name = "alert_pattern", length = 500)
    private String alertPattern;

    @Column(name = "severity_min")
    private Integer severityMin;

    @Column(name = "severity_max")
    private Integer severityMax;

    @Enumerated(EnumType.STRING)
    @Column(nullable = false, length = 40)
    private AlertTriageAction action;

    @Column(columnDefinition = "TEXT")
    private String reason;

    @Column(name = "silenced_until")
    private LocalDateTime silencedUntil;

    @Column(nullable = false)
    private boolean enabled;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "created_by")
    private User createdBy;

    @Column(name = "created_at", nullable = false, updatable = false)
    private LocalDateTime createdAt;

    @Column(name = "updated_at", nullable = false)
    private LocalDateTime updatedAt;

    @PrePersist
    void prePersist() {
        if (action == null) action = AlertTriageAction.SHOW_ONLY;
        if (createdAt == null) createdAt = LocalDateTime.now();
        updatedAt = LocalDateTime.now();
        enabled = true;
    }

    @PreUpdate
    void preUpdate() {
        updatedAt = LocalDateTime.now();
    }
}
