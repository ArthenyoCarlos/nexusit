package br.com.nexusit.urlmonitor;

import jakarta.persistence.*;
import lombok.*;

import java.time.LocalDateTime;
import java.util.UUID;

@Entity
@Table(name = "monitored_urls")
@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class MonitoredUrl {

    @Id
    @GeneratedValue(strategy = GenerationType.UUID)
    private UUID id;

    @Column(nullable = false)
    private String name;

    @Column(nullable = false, length = 500)
    private String url;

    @Column(nullable = false)
    @Builder.Default
    private Boolean enabled = true;

    @Column(name = "interval_sec", nullable = false)
    @Builder.Default
    private Integer intervalSec = 300;

    @Column(name = "last_check")
    private LocalDateTime lastCheck;

    @Column(name = "last_status")
    private Integer lastStatus;

    @Column(name = "last_ok")
    private LocalDateTime lastOk;

    @Column(name = "uptime_pct", precision = 5, scale = 2)
    private java.math.BigDecimal uptimePct;

    @Column(name = "created_at", nullable = false, updatable = false)
    private LocalDateTime createdAt;

    @PrePersist
    void prePersist() { if (createdAt == null) createdAt = LocalDateTime.now(); }
}
