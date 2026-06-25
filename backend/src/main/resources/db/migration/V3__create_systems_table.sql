CREATE TYPE system_category AS ENUM (
    'ERP', 'CRM', 'INTERNO', 'CLOUD', 'MONITORAMENTO', 'OUTRO'
);

CREATE TYPE system_status AS ENUM ('ACTIVE', 'INACTIVE');

CREATE TABLE systems (
    id             UUID            PRIMARY KEY DEFAULT gen_random_uuid(),
    name           VARCHAR(255)    NOT NULL,
    url            VARCHAR(500),
    description    TEXT,
    category       system_category NOT NULL DEFAULT 'OUTRO',
    server_id      UUID            REFERENCES inventory_items(id) ON DELETE SET NULL,
    responsible_id UUID            REFERENCES users(id) ON DELETE SET NULL,
    status         system_status   NOT NULL DEFAULT 'ACTIVE',
    documentation  TEXT,
    created_at     TIMESTAMP       NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_systems_category ON systems(category);
CREATE INDEX idx_systems_status   ON systems(status);
