CREATE TABLE note_tags (
    id          UUID         PRIMARY KEY DEFAULT gen_random_uuid(),
    note_id     UUID         NOT NULL REFERENCES notes(id) ON DELETE CASCADE,
    tag         VARCHAR(100),
    category    VARCHAR(100)
);
