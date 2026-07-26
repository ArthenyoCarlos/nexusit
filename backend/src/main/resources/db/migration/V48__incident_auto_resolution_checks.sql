CREATE TABLE IF NOT EXISTS incident_resolution_checks (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    incident_id UUID NOT NULL REFERENCES correlated_incidents(id) ON DELETE CASCADE,
    status VARCHAR(40) NOT NULL,
    reason TEXT NOT NULL,
    minutes_stable INTEGER NOT NULL DEFAULT 0,
    active_source_present BOOLEAN NOT NULL DEFAULT FALSE,
    checked_at TIMESTAMP NOT NULL DEFAULT NOW(),
    created_at TIMESTAMP NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_incident_resolution_checks_incident_checked
    ON incident_resolution_checks(incident_id, checked_at DESC);

CREATE INDEX IF NOT EXISTS idx_incident_resolution_checks_status_checked
    ON incident_resolution_checks(status, checked_at DESC);
