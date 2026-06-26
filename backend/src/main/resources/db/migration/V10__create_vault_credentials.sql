CREATE TABLE vault_credentials (
    id          UUID         PRIMARY KEY DEFAULT gen_random_uuid(),
    title       VARCHAR(255) NOT NULL,
    type        VARCHAR(30)  NOT NULL DEFAULT 'PASSWORD',
    username    VARCHAR(255),
    secret      TEXT         NOT NULL,
    url         VARCHAR(500),
    description TEXT,
    tags        VARCHAR(500),
    created_by  UUID         REFERENCES users(id) ON DELETE SET NULL,
    created_at  TIMESTAMP    NOT NULL DEFAULT NOW(),
    updated_at  TIMESTAMP    NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_vault_title ON vault_credentials(title);
CREATE INDEX idx_vault_type  ON vault_credentials(type);
