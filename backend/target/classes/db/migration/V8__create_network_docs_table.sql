CREATE TABLE network_docs (
    id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    title       VARCHAR(255) NOT NULL,
    section     VARCHAR(50)  NOT NULL DEFAULT 'Outros',
    content     TEXT,
    updated_by  UUID REFERENCES users(id) ON DELETE SET NULL,
    updated_at  TIMESTAMPTZ  NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_network_docs_section ON network_docs(section);
