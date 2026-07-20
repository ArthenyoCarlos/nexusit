CREATE TABLE notification_groups (
    id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name       VARCHAR(255) NOT NULL,
    group_jid  VARCHAR(64)  NOT NULL UNIQUE,
    active     BOOLEAN      NOT NULL DEFAULT TRUE,
    created_at TIMESTAMP    NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_notification_groups_active ON notification_groups(active);
