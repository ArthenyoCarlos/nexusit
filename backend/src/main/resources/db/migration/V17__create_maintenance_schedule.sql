CREATE TABLE maintenance_schedules (
    id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    title         VARCHAR(300) NOT NULL,
    description   TEXT,
    recurrence    VARCHAR(20) NOT NULL DEFAULT 'MONTHLY',
    next_due      DATE NOT NULL,
    assigned_to   UUID REFERENCES users(id),
    active        BOOLEAN NOT NULL DEFAULT TRUE,
    created_by    UUID REFERENCES users(id),
    created_at    TIMESTAMP NOT NULL DEFAULT NOW()
);

CREATE TABLE maintenance_schedule_logs (
    id             UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    schedule_id    UUID NOT NULL REFERENCES maintenance_schedules(id) ON DELETE CASCADE,
    completed_at   DATE NOT NULL DEFAULT CURRENT_DATE,
    notes          TEXT,
    completed_by   UUID REFERENCES users(id)
);
