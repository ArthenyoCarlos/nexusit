CREATE TABLE IF NOT EXISTS incident_action_results (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    incident_id UUID NOT NULL REFERENCES correlated_incidents(id) ON DELETE CASCADE,
    action_key VARCHAR(80) NOT NULL,
    status VARCHAR(40) NOT NULL,
    title VARCHAR(240),
    summary TEXT,
    output TEXT,
    executed_by VARCHAR(160),
    executed_at TIMESTAMP NOT NULL DEFAULT NOW(),
    duration_ms BIGINT,
    created_at TIMESTAMP NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_incident_action_results_incident_executed ON incident_action_results(incident_id, executed_at DESC);
CREATE INDEX IF NOT EXISTS idx_incident_action_results_action ON incident_action_results(action_key, executed_at DESC);
