CREATE TABLE whatsapp_contacts (
    id             UUID         PRIMARY KEY DEFAULT gen_random_uuid(),
    phone_number   VARCHAR(32)  NOT NULL UNIQUE,
    display_name   VARCHAR(255),
    glpi_user_id   INTEGER,
    glpi_user_name VARCHAR(255),
    created_at     TIMESTAMP    NOT NULL DEFAULT NOW()
);

CREATE TABLE support_conversations (
    id             UUID         PRIMARY KEY DEFAULT gen_random_uuid(),
    contact_id     UUID         NOT NULL REFERENCES whatsapp_contacts(id) ON DELETE CASCADE,
    state          VARCHAR(24)  NOT NULL DEFAULT 'AWAITING_NAME',
    glpi_ticket_id INTEGER,
    claimed_by     UUID         REFERENCES users(id) ON DELETE SET NULL,
    created_at     TIMESTAMP    NOT NULL DEFAULT NOW(),
    claimed_at     TIMESTAMP,
    closed_at      TIMESTAMP,
    CONSTRAINT chk_conversation_state CHECK (state IN
        ('AWAITING_NAME', 'MENU', 'AWAITING_DESCRIPTION', 'PENDING_TECH', 'HUMAN_ACTIVE', 'CLOSED'))
);

CREATE INDEX idx_support_conversations_contact ON support_conversations(contact_id);
CREATE INDEX idx_support_conversations_state   ON support_conversations(state);

CREATE TABLE support_messages (
    id              UUID         PRIMARY KEY DEFAULT gen_random_uuid(),
    conversation_id UUID         NOT NULL REFERENCES support_conversations(id) ON DELETE CASCADE,
    direction       VARCHAR(3)   NOT NULL,
    author          VARCHAR(10)  NOT NULL,
    author_name     VARCHAR(255),
    content         TEXT,
    created_at      TIMESTAMP    NOT NULL DEFAULT NOW(),
    CONSTRAINT chk_message_direction CHECK (direction IN ('IN', 'OUT')),
    CONSTRAINT chk_message_author CHECK (author IN ('EMPLOYEE', 'HERMES', 'TECH'))
);

CREATE INDEX idx_support_messages_conversation ON support_messages(conversation_id);
