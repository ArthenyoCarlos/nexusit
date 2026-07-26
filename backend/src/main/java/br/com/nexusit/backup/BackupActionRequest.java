package br.com.nexusit.backup;

import jakarta.persistence.*;
import lombok.*;
import java.time.LocalDateTime;
import java.util.UUID;

@Entity
@Table(name = "backup_action_requests")
@Data @Builder @NoArgsConstructor @AllArgsConstructor
public class BackupActionRequest {
    @Id @GeneratedValue(strategy = GenerationType.UUID) private UUID id;
    @ManyToOne(fetch = FetchType.LAZY) @JoinColumn(name = "job_id", nullable = false) private BackupJob job;
    @Column(nullable = false, length = 40) private String action;
    @Column(nullable = false, length = 40) private String status;
    @Column(name = "requested_by", length = 160) private String requestedBy;
    @Column(name = "requested_at", nullable = false) private LocalDateTime requestedAt;
    @Column(name = "started_at") private LocalDateTime startedAt;
    @Column(name = "finished_at") private LocalDateTime finishedAt;
    @Column(name = "result_message", columnDefinition = "TEXT") private String resultMessage;
    @Column(name = "created_at", nullable = false, updatable = false) private LocalDateTime createdAt;
    @Column(name = "updated_at", nullable = false) private LocalDateTime updatedAt;
    @PrePersist void prePersist(){ var now=LocalDateTime.now(); if(status==null) status="QUEUED"; if(requestedAt==null) requestedAt=now; if(createdAt==null) createdAt=now; updatedAt=now; }
    @PreUpdate void preUpdate(){ updatedAt=LocalDateTime.now(); }
}
