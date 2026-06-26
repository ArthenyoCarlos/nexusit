CREATE TABLE licenses (
    id             UUID          PRIMARY KEY DEFAULT gen_random_uuid(),
    name           VARCHAR(255)  NOT NULL,
    vendor         VARCHAR(100),
    product        VARCHAR(255),
    license_key    TEXT,
    seats_total    INTEGER,
    seats_used     INTEGER       NOT NULL DEFAULT 0,
    purchase_date  DATE,
    expiry_date    DATE,
    value          NUMERIC(12,2),
    notes          TEXT,
    created_at     TIMESTAMP     NOT NULL DEFAULT NOW(),
    updated_at     TIMESTAMP     NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_licenses_expiry ON licenses(expiry_date);
