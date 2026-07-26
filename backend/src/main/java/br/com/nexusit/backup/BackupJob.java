package br.com.nexusit.backup;

import jakarta.persistence.*;
import lombok.*;
import java.time.LocalDateTime;
import java.util.UUID;

@Entity
@Table(name = "backup_jobs")
@Data @Builder @NoArgsConstructor @AllArgsConstructor
public class BackupJob {
    @Id @GeneratedValue(strategy = GenerationType.UUID)
    private UUID id;
    @Column(nullable = false, length = 160) private String name;
    @Column(name = "system_name", nullable = false, length = 120) private String systemName;
    @Column(name = "source_type", nullable = false, length = 40) private String sourceType;
    @Column(name = "source_ref", length = 500) private String sourceRef;
    @Column(name = "target_ref", length = 500) private String targetRef;
    @Column(name = "schedule_label", length = 160) private String scheduleLabel;
    @Column(name = "expected_frequency_minutes", nullable = false) private int expectedFrequencyMinutes;
    @Column(name = "stale_after_minutes", nullable = false) private int staleAfterMinutes;
    @Column(nullable = false) private boolean enabled;
    @Column(length = 120) private String owner;
    @Column(columnDefinition = "TEXT") private String notes;
    @Column(name = "created_at", nullable = false, updatable = false) private LocalDateTime createdAt;
    @Column(name = "updated_at", nullable = false) private LocalDateTime updatedAt;
    @PrePersist void prePersist(){ var now=LocalDateTime.now(); if(createdAt==null) createdAt=now; updatedAt=now; if(expectedFrequencyMinutes<=0) expectedFrequencyMinutes=1440; if(staleAfterMinutes<=0) staleAfterMinutes=1560; }
    @PreUpdate void preUpdate(){ updatedAt=LocalDateTime.now(); }
}
