package br.com.nexusit.backup;

import jakarta.persistence.*;
import lombok.*;
import java.time.LocalDateTime;
import java.util.UUID;

@Entity
@Table(name = "backup_runs")
@Data @Builder @NoArgsConstructor @AllArgsConstructor
public class BackupRun {
    @Id @GeneratedValue(strategy = GenerationType.UUID)
    private UUID id;
    @ManyToOne(fetch = FetchType.LAZY) @JoinColumn(name = "job_id", nullable = false) private BackupJob job;
    @Column(nullable = false, length = 40) private String status;
    @Column(name = "started_at") private LocalDateTime startedAt;
    @Column(name = "finished_at", nullable = false) private LocalDateTime finishedAt;
    @Column(name = "duration_seconds") private Integer durationSeconds;
    @Column(name = "size_bytes") private Long sizeBytes;
    @Column(name = "artifact_ref", length = 500) private String artifactRef;
    @Column(columnDefinition = "TEXT") private String message;
    @Column(name = "created_at", nullable = false, updatable = false) private LocalDateTime createdAt;
    @PrePersist void prePersist(){ var now=LocalDateTime.now(); if(finishedAt==null) finishedAt=now; if(createdAt==null) createdAt=now; }
}
