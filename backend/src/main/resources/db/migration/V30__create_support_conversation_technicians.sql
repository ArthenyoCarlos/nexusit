ALTER TABLE support_conversations ADD COLUMN glpi_ticket_user_id INTEGER;

CREATE TABLE support_conversation_technicians (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    conversation_id UUID NOT NULL REFERENCES support_conversations(id) ON DELETE CASCADE,
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    glpi_ticket_user_id INTEGER,
    added_at TIMESTAMP NOT NULL DEFAULT NOW(),
    UNIQUE (conversation_id, user_id)
);
