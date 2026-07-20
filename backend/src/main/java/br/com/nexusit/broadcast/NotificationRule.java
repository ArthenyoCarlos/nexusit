package br.com.nexusit.broadcast;

import jakarta.persistence.*;
import lombok.*;

import java.time.LocalDateTime;
import java.util.UUID;

/**
 * "Se o servidor X apresentar problema, disparar mensagem Y para o contato/grupo Z."
 * MANUAL rules only fire when a technician clicks "Disparar agora" (host/problem state is
 * irrelevant then — it's just a saved target+message shortcut). AUTOMATIC rules are polled
 * by NotificationRuleService against active Zabbix problems for the configured host.
 */
@Entity
@Table(name = "notification_rules")
@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class NotificationRule {

    @Id
    @GeneratedValue(strategy = GenerationType.UUID)
    private UUID id;

    @Column(nullable = false)
    private String name;

    @Column(name = "host_id", nullable = false)
    private String hostId;

    @Column(name = "host_name")
    private String hostName;

    @Column(nullable = false, columnDefinition = "TEXT")
    private String message;

    @Enumerated(EnumType.STRING)
    @Column(name = "target_type", nullable = false, length = 20)
    private TargetType targetType;

    @Column(name = "target_id", nullable = false)
    private UUID targetId;

    @Column(name = "target_label")
    private String targetLabel;

    @Enumerated(EnumType.STRING)
    @Column(nullable = false, length = 20)
    private RuleMode mode;

    @Column(nullable = false)
    private boolean active;

    @Column(name = "cooldown_minutes", nullable = false)
    private int cooldownMinutes;

    @Column(name = "last_triggered_at")
    private LocalDateTime lastTriggeredAt;

    @Column(name = "created_by_name")
    private String createdByName;

    @Column(name = "created_at", nullable = false, updatable = false)
    private LocalDateTime createdAt;

    @PrePersist
    void prePersist() {
        if (createdAt == null) createdAt = LocalDateTime.now();
        if (cooldownMinutes <= 0) cooldownMinutes = 30;
    }
}
