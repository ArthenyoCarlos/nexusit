package br.com.nexusit.mschedule;

import br.com.nexusit.user.User;
import jakarta.persistence.*;
import lombok.*;
import java.time.LocalDate;
import java.time.LocalDateTime;
import java.util.UUID;

@Entity @Table(name = "maintenance_schedules") @Data @Builder @NoArgsConstructor @AllArgsConstructor
public class MaintenanceSchedule {
    @Id @GeneratedValue(strategy = GenerationType.UUID)
    private UUID id;
    @Column(nullable = false) private String title;
    @Column(columnDefinition = "TEXT") private String description;
    @Column(nullable = false) private String recurrence; // DAILY, WEEKLY, MONTHLY, QUARTERLY, YEARLY
    @Column(nullable = false) private LocalDate nextDue;
    @ManyToOne(fetch = FetchType.LAZY) @JoinColumn(name = "assigned_to") private User assignedTo;
    @Column(nullable = false) private boolean active;
    @ManyToOne(fetch = FetchType.LAZY) @JoinColumn(name = "created_by") private User createdBy;
    @Column(nullable = false) private LocalDateTime createdAt;

    @PrePersist void pre() { createdAt = LocalDateTime.now(); if (!active) active = true; }
}
