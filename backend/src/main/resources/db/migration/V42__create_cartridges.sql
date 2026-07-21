CREATE SEQUENCE cartridge_code_seq START WITH 1;

CREATE TABLE cartridges (
    id             UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    code           VARCHAR(20)  NOT NULL UNIQUE,
    model          VARCHAR(255) NOT NULL,
    printer_model  VARCHAR(255),
    status         VARCHAR(20)  NOT NULL DEFAULT 'EM_ESTOQUE',
    current_sector VARCHAR(255),
    created_at     TIMESTAMP    NOT NULL DEFAULT NOW(),
    updated_at     TIMESTAMP    NOT NULL DEFAULT NOW()
);

CREATE TABLE cartridge_events (
    id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    cartridge_id      UUID NOT NULL REFERENCES cartridges(id) ON DELETE CASCADE,
    type              VARCHAR(30) NOT NULL,
    sector            VARCHAR(255),
    notes             TEXT,
    performed_by_name VARCHAR(255),
    created_at        TIMESTAMP NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_cartridges_status ON cartridges(status);
CREATE INDEX idx_cartridge_events_cartridge ON cartridge_events(cartridge_id, created_at DESC);
