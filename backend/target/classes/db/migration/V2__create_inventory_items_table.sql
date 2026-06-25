CREATE TYPE item_type AS ENUM (
    'COMPUTADOR', 'SERVIDOR', 'SWITCH', 'ROTEADOR',
    'IMPRESSORA', 'NOBREAK', 'OUTRO'
);

CREATE TYPE item_status AS ENUM ('ACTIVE', 'INACTIVE', 'MAINTENANCE');

CREATE TABLE inventory_items (
    id             UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
    name           VARCHAR(255) NOT NULL,
    type           item_type   NOT NULL,
    brand          VARCHAR(100),
    model          VARCHAR(100),
    serial_number  VARCHAR(100),
    location       VARCHAR(255),
    responsible_id UUID        REFERENCES users(id) ON DELETE SET NULL,
    purchase_date  DATE,
    status         item_status NOT NULL DEFAULT 'ACTIVE',
    notes          TEXT,
    created_at     TIMESTAMP   NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_inventory_type   ON inventory_items(type);
CREATE INDEX idx_inventory_status ON inventory_items(status);
