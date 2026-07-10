CREATE TABLE meetings (
    id            UUID         PRIMARY KEY DEFAULT gen_random_uuid(),
    title         VARCHAR(255) NOT NULL,
    type          VARCHAR(30)  NOT NULL DEFAULT 'EQUIPE',
    company_name  VARCHAR(255),
    meeting_date  DATE         NOT NULL,
    participants  TEXT,
    summary       TEXT,
    next_steps    TEXT,
    created_by    UUID         REFERENCES users(id) ON DELETE SET NULL,
    created_at    TIMESTAMP    NOT NULL DEFAULT NOW(),
    updated_at    TIMESTAMP    NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_meetings_date ON meetings(meeting_date DESC);
