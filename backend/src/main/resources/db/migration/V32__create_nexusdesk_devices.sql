CREATE TABLE nexusdesk_devices (
    id                  UUID         PRIMARY KEY DEFAULT gen_random_uuid(),
    name                VARCHAR(255) NOT NULL,
    rustdesk_id         VARCHAR(32)  NOT NULL,
    encrypted_password  TEXT,
    notes               TEXT,
    inventory_item_id   UUID         REFERENCES inventory_items(id) ON DELETE SET NULL,
    created_by          UUID         REFERENCES users(id) ON DELETE SET NULL,
    created_at          TIMESTAMP    NOT NULL DEFAULT NOW(),
    updated_at          TIMESTAMP    NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_nexusdesk_devices_name ON nexusdesk_devices(name);
