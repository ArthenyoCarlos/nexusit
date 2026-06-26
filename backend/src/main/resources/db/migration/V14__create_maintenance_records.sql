CREATE TABLE maintenance_records (
    id           UUID         PRIMARY KEY DEFAULT gen_random_uuid(),
    inventory_id UUID         NOT NULL REFERENCES inventory_items(id) ON DELETE CASCADE,
    title        VARCHAR(255) NOT NULL,
    description  TEXT,
    performed_at DATE         NOT NULL,
    cost         NUMERIC(10,2),
    performed_by UUID         REFERENCES users(id) ON DELETE SET NULL,
    created_at   TIMESTAMP    NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_maintenance_inventory ON maintenance_records(inventory_id);
CREATE INDEX idx_maintenance_date      ON maintenance_records(performed_at DESC);
