CREATE TABLE financial_bills (
    id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    title       VARCHAR(300) NOT NULL,
    vendor      VARCHAR(200),
    category    VARCHAR(100) DEFAULT 'Outros',
    amount      NUMERIC(12,2) NOT NULL,
    due_date    DATE NOT NULL,
    paid        BOOLEAN NOT NULL DEFAULT FALSE,
    paid_at     DATE,
    notes       TEXT,
    created_by  UUID REFERENCES users(id),
    created_at  TIMESTAMP NOT NULL DEFAULT NOW()
);
