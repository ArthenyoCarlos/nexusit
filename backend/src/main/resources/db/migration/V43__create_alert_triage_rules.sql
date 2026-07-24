CREATE TABLE IF NOT EXISTS alert_triage_rules (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    host_pattern VARCHAR(255),
    alert_pattern VARCHAR(500),
    severity_min INTEGER,
    severity_max INTEGER,
    action VARCHAR(40) NOT NULL DEFAULT 'SHOW_ONLY',
    reason TEXT,
    silenced_until TIMESTAMP,
    enabled BOOLEAN NOT NULL DEFAULT TRUE,
    created_by UUID REFERENCES users(id) ON DELETE SET NULL,
    created_at TIMESTAMP NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMP NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_alert_triage_rules_enabled ON alert_triage_rules(enabled);
CREATE INDEX IF NOT EXISTS idx_alert_triage_rules_action ON alert_triage_rules(action);
CREATE INDEX IF NOT EXISTS idx_alert_triage_rules_host_pattern ON alert_triage_rules(host_pattern);
CREATE INDEX IF NOT EXISTS idx_alert_triage_rules_alert_pattern ON alert_triage_rules(alert_pattern);
