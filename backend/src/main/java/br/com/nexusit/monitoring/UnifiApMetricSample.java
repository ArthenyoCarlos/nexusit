package br.com.nexusit.monitoring;

import jakarta.persistence.*;
import lombok.*;

import java.time.LocalDateTime;
import java.util.UUID;

/**
 * Uma "foto" periódica de um AP UniFi, capturada pelo NexusIT a partir do snapshot que o
 * coletor Hermes (externo a este repo) escreve — esse snapshot só traz agregados de 24h,
 * sem histórico ponto-a-ponto, então é o NexusIT quem monta a série temporal salvando uma
 * linha destas a cada captura.
 */
@Entity
@Table(name = "unifi_ap_metric_samples")
@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class UnifiApMetricSample {

    @Id
    @GeneratedValue(strategy = GenerationType.UUID)
    private UUID id;

    @Column(name = "ap_name", nullable = false)
    private String apName;

    @Column(name = "recorded_at", nullable = false)
    private LocalDateTime recordedAt;

    @Column(name = "loss_pct")
    private Double lossPct;

    @Column(name = "rtt_ms")
    private Double rttMs;

    @Column(name = "client_count")
    private Integer clientCount;

    @PrePersist
    void prePersist() {
        if (recordedAt == null) recordedAt = LocalDateTime.now();
    }
}
