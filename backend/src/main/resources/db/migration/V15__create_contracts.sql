CREATE TABLE contracts (
    id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name          VARCHAR(200) NOT NULL,
    vendor        VARCHAR(200),
    contact_name  VARCHAR(200),
    contact_email VARCHAR(200),
    contact_phone VARCHAR(50),
    type          VARCHAR(20) NOT NULL DEFAULT 'ANUAL',
    value         NUMERIC(12,2),
    start_date    DATE,
    end_date      DATE,
    auto_renew    BOOLEAN NOT NULL DEFAULT FALSE,
    notes         TEXT,
    created_by    UUID REFERENCES users(id),
    created_at    TIMESTAMP NOT NULL DEFAULT NOW(),
    updated_at    TIMESTAMP NOT NULL DEFAULT NOW()
);
