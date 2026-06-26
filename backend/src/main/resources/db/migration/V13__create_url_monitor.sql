CREATE TABLE monitored_urls (
    id           UUID         PRIMARY KEY DEFAULT gen_random_uuid(),
    name         VARCHAR(255) NOT NULL,
    url          VARCHAR(500) NOT NULL,
    enabled      BOOLEAN      NOT NULL DEFAULT TRUE,
    interval_sec INTEGER      NOT NULL DEFAULT 300,
    last_check   TIMESTAMP,
    last_status  INTEGER,
    last_ok      TIMESTAMP,
    uptime_pct   NUMERIC(5,2),
    created_at   TIMESTAMP    NOT NULL DEFAULT NOW()
);

CREATE TABLE url_check_results (
    id          UUID      PRIMARY KEY DEFAULT gen_random_uuid(),
    monitor_id  UUID      NOT NULL REFERENCES monitored_urls(id) ON DELETE CASCADE,
    checked_at  TIMESTAMP NOT NULL DEFAULT NOW(),
    status_code INTEGER,
    response_ms INTEGER,
    ok          BOOLEAN   NOT NULL
);

CREATE INDEX idx_url_check_monitor ON url_check_results(monitor_id);
CREATE INDEX idx_url_check_time    ON url_check_results(checked_at DESC);
