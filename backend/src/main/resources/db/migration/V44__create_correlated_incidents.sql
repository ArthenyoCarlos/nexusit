CREATE TABLE IF NOT EXISTS correlated_incidents (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    correlation_key VARCHAR(500) NOT NULL UNIQUE,
    source_type VARCHAR(40) NOT NULL,
    category VARCHAR(80) NOT NULL,
    title VARCHAR(500) NOT NULL,
    affected_host VARCHAR(255),
    severity INTEGER NOT NULL DEFAULT 0,
    status VARCHAR(40) NOT NULL DEFAULT 'OPEN',
    first_seen_at TIMESTAMP NOT NULL DEFAULT NOW(),
    last_seen_at TIMESTAMP NOT NULL DEFAULT NOW(),
    occurrence_count INTEGER NOT NULL DEFAULT 1,
    last_source_event_id VARCHAR(120),
    open_glpi_ticket_id INTEGER,
    summary TEXT,
    recommendation TEXT,
    created_at TIMESTAMP NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMP NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS correlated_incident_events (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    incident_id UUID NOT NULL REFERENCES correlated_incidents(id) ON DELETE CASCADE,
    source_type VARCHAR(40) NOT NULL,
    source_event_id VARCHAR(120),
    event_type VARCHAR(80) NOT NULL,
    severity INTEGER NOT NULL DEFAULT 0,
    message TEXT NOT NULL,
    payload JSONB,
    observed_at TIMESTAMP NOT NULL DEFAULT NOW(),
    created_at TIMESTAMP NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_correlated_incidents_status ON correlated_incidents(status);
CREATE INDEX IF NOT EXISTS idx_correlated_incidents_ticket ON correlated_incidents(open_glpi_ticket_id);
CREATE INDEX IF NOT EXISTS idx_correlated_incidents_host ON correlated_incidents(affected_host);
CREATE INDEX IF NOT EXISTS idx_correlated_incidents_last_seen ON correlated_incidents(last_seen_at DESC);
CREATE INDEX IF NOT EXISTS idx_correlated_incident_events_incident ON correlated_incident_events(incident_id, observed_at DESC);
CREATE INDEX IF NOT EXISTS idx_correlated_incident_events_source ON correlated_incident_events(source_type, source_event_id);

ALTER TABLE alert_triage_rules
    ADD COLUMN IF NOT EXISTS min_duration_minutes INTEGER,
    ADD COLUMN IF NOT EXISTS recurrence_window_minutes INTEGER,
    ADD COLUMN IF NOT EXISTS recurrence_count_threshold INTEGER;
