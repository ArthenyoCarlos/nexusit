CREATE TABLE nexusdesk_sessions (
    id              UUID      PRIMARY KEY DEFAULT gen_random_uuid(),
    device_id       UUID      NOT NULL REFERENCES nexusdesk_devices(id) ON DELETE CASCADE,
    user_id         UUID      NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    glpi_ticket_id  INTEGER,
    started_at      TIMESTAMP NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_nexusdesk_sessions_device_id ON nexusdesk_sessions(device_id);
CREATE INDEX idx_nexusdesk_sessions_started_at ON nexusdesk_sessions(started_at);
