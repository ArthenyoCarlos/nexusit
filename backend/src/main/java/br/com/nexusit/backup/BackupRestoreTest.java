package br.com.nexusit.backup;

import jakarta.persistence.*;
import lombok.*;
import java.time.LocalDateTime;
import java.util.UUID;

@Entity
@Table(name = "backup_restore_tests")
@Data @Builder @NoArgsConstructor @AllArgsConstructor
public class BackupRestoreTest {
    @Id @GeneratedValue(strategy = GenerationType.UUID) private UUID id;
    @ManyToOne(fetch = FetchType.LAZY) @JoinColumn(name = "job_id", nullable = false) private BackupJob job;
    @Column(nullable = false, length = 40) private String status;
    @Column(name = "tested_at", nullable = false) private LocalDateTime testedAt;
    @Column(name = "duration_seconds") private Integer durationSeconds;
    @Column(name = "tested_artifact_ref", length = 500) private String testedArtifactRef;
    @Column(columnDefinition = "TEXT") private String message;
    @Column(name = "validated_by", length = 160) private String validatedBy;
    @Column(name = "created_at", nullable = false, updatable = false) private LocalDateTime createdAt;
    @PrePersist void prePersist(){ var now=LocalDateTime.now(); if(testedAt==null) testedAt=now; if(createdAt==null) createdAt=now; }
}
