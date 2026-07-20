CREATE TABLE notification_rules (
    id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name              VARCHAR(255) NOT NULL,
    host_id           VARCHAR(64)  NOT NULL,
    host_name         VARCHAR(255),
    message           TEXT         NOT NULL,
    target_type       VARCHAR(20)  NOT NULL,
    target_id         UUID         NOT NULL,
    target_label      VARCHAR(255),
    mode              VARCHAR(20)  NOT NULL,
    active            BOOLEAN      NOT NULL DEFAULT TRUE,
    cooldown_minutes  INTEGER      NOT NULL DEFAULT 30,
    last_triggered_at TIMESTAMP,
    created_by_name   VARCHAR(255),
    created_at        TIMESTAMP    NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_notification_rules_mode_active ON notification_rules(mode, active);
CREATE INDEX idx_notification_rules_host ON notification_rules(host_id);
