CREATE TABLE unifi_ap_metric_samples (
    id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    ap_name      VARCHAR(255)     NOT NULL,
    recorded_at  TIMESTAMP        NOT NULL DEFAULT NOW(),
    loss_pct     DOUBLE PRECISION,
    rtt_ms       DOUBLE PRECISION,
    client_count INTEGER
);

CREATE INDEX idx_unifi_ap_metric_samples_ap_time ON unifi_ap_metric_samples(ap_name, recorded_at);
