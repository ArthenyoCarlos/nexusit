package br.com.nexusit.urlmonitor;

import jakarta.persistence.*;
import lombok.*;

import java.time.LocalDateTime;
import java.util.UUID;

@Entity
@Table(name = "url_check_results")
@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class UrlCheckResult {

    @Id
    @GeneratedValue(strategy = GenerationType.UUID)
    private UUID id;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "monitor_id", nullable = false)
    private MonitoredUrl monitor;

    @Column(name = "checked_at", nullable = false)
    private LocalDateTime checkedAt;

    @Column(name = "status_code")
    private Integer statusCode;

    @Column(name = "response_ms")
    private Integer responseMs;

    @Column(nullable = false)
    private Boolean ok;
}
