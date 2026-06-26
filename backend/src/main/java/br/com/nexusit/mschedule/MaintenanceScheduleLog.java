package br.com.nexusit.mschedule;

import br.com.nexusit.user.User;
import jakarta.persistence.*;
import lombok.*;
import java.time.LocalDate;
import java.util.UUID;

@Entity @Table(name = "maintenance_schedule_logs") @Data @Builder @NoArgsConstructor @AllArgsConstructor
public class MaintenanceScheduleLog {
    @Id @GeneratedValue(strategy = GenerationType.UUID)
    private UUID id;
    @ManyToOne(fetch = FetchType.LAZY) @JoinColumn(name = "schedule_id", nullable = false)
    private MaintenanceSchedule schedule;
    @Column(nullable = false) private LocalDate completedAt;
    @Column(columnDefinition = "TEXT") private String notes;
    @ManyToOne(fetch = FetchType.LAZY) @JoinColumn(name = "completed_by") private User completedBy;
}
