CREATE TABLE audit_events (
    id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    module       VARCHAR(30)  NOT NULL,
    action       VARCHAR(50)  NOT NULL,
    actor_id     UUID         REFERENCES users(id) ON DELETE SET NULL,
    actor_name   VARCHAR(255),
    target_type  VARCHAR(50),
    target_id    UUID,
    target_label VARCHAR(255),
    details      TEXT,
    created_at   TIMESTAMP    NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_audit_events_created ON audit_events(created_at DESC);
CREATE INDEX idx_audit_events_module ON audit_events(module);
