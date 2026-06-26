CREATE TABLE onboarding_checklists (
    id            UUID         PRIMARY KEY DEFAULT gen_random_uuid(),
    type          VARCHAR(20)  NOT NULL, -- ONBOARDING | OFFBOARDING
    employee_name VARCHAR(255) NOT NULL,
    department    VARCHAR(100),
    start_date    DATE,
    notes         TEXT,
    created_by    UUID         REFERENCES users(id) ON DELETE SET NULL,
    created_at    TIMESTAMP    NOT NULL DEFAULT NOW(),
    updated_at    TIMESTAMP    NOT NULL DEFAULT NOW()
);

CREATE TABLE onboarding_checklist_items (
    id           UUID         PRIMARY KEY DEFAULT gen_random_uuid(),
    checklist_id UUID         NOT NULL REFERENCES onboarding_checklists(id) ON DELETE CASCADE,
    title        VARCHAR(255) NOT NULL,
    description  TEXT,
    item_order   INTEGER      NOT NULL DEFAULT 0,
    done         BOOLEAN      NOT NULL DEFAULT FALSE,
    done_at      TIMESTAMP,
    done_by      UUID         REFERENCES users(id) ON DELETE SET NULL,
    created_at   TIMESTAMP    NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_onboarding_type      ON onboarding_checklists(type);
CREATE INDEX idx_checklist_items_list ON onboarding_checklist_items(checklist_id);
