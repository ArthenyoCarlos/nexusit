CREATE TABLE ssh_hosts (
    id                    UUID         PRIMARY KEY DEFAULT gen_random_uuid(),
    name                  VARCHAR(255) NOT NULL,
    host                  VARCHAR(255) NOT NULL,
    port                  INTEGER      NOT NULL DEFAULT 22,
    username              VARCHAR(100) NOT NULL,
    encrypted_password    TEXT         NOT NULL,
    host_key_fingerprint  VARCHAR(128),
    description           TEXT,
    inventory_item_id     UUID         REFERENCES inventory_items(id) ON DELETE SET NULL,
    created_by            UUID         REFERENCES users(id) ON DELETE SET NULL,
    created_at            TIMESTAMP    NOT NULL DEFAULT NOW(),
    updated_at            TIMESTAMP    NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_ssh_hosts_name ON ssh_hosts(name);
