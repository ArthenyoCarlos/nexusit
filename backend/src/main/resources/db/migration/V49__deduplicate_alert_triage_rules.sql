-- Deduplicate alert triage rules created by repeated Discard/Silence clicks.
-- Keep the active newest rule when possible; otherwise keep the newest inactive rule.
WITH ranked AS (
    SELECT id,
           row_number() OVER (
               PARTITION BY
                   COALESCE(host_pattern, ''),
                   COALESCE(alert_pattern, ''),
                   COALESCE(severity_min, -1),
                   COALESCE(severity_max, -1),
                   action
               ORDER BY enabled DESC, updated_at DESC, created_at DESC, id DESC
           ) AS rn
      FROM alert_triage_rules
)
DELETE FROM alert_triage_rules r
 USING ranked d
 WHERE r.id = d.id
   AND d.rn > 1;

CREATE UNIQUE INDEX IF NOT EXISTS ux_alert_triage_rules_logical_decision
    ON alert_triage_rules (
        COALESCE(host_pattern, ''),
        COALESCE(alert_pattern, ''),
        COALESCE(severity_min, -1),
        COALESCE(severity_max, -1),
        action
    );
