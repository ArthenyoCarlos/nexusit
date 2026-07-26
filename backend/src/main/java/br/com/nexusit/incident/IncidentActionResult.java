package br.com.nexusit.incident;

import jakarta.persistence.*;
import lombok.*;
import java.time.LocalDateTime;
import java.util.UUID;

@Entity
@Table(name = "incident_action_results")
@Data @Builder @NoArgsConstructor @AllArgsConstructor
public class IncidentActionResult {
    @Id @GeneratedValue(strategy = GenerationType.UUID) private UUID id;
    @ManyToOne(fetch = FetchType.LAZY) @JoinColumn(name = "incident_id", nullable = false) private CorrelatedIncident incident;
    @Column(name = "action_key", nullable = false, length = 80) private String actionKey;
    @Column(nullable = false, length = 40) private String status;
    @Column(length = 240) private String title;
    @Column(columnDefinition = "TEXT") private String summary;
    @Column(columnDefinition = "TEXT") private String output;
    @Column(name = "executed_by", length = 160) private String executedBy;
    @Column(name = "executed_at", nullable = false) private LocalDateTime executedAt;
    @Column(name = "duration_ms") private Long durationMs;
    @Column(name = "created_at", nullable = false, updatable = false) private LocalDateTime createdAt;
    @PrePersist void prePersist(){ var now=LocalDateTime.now(); if(executedAt==null) executedAt=now; if(createdAt==null) createdAt=now; }
}
