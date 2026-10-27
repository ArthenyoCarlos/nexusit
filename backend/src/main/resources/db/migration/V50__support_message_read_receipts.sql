-- Historical inbound messages remain unread locally; never invent provider identities or receipts.
ALTER TABLE support_messages
    ADD COLUMN provider_message_id VARCHAR(255),
    ADD COLUMN remote_jid VARCHAR(255),
    ADD COLUMN from_me BOOLEAN,
    ADD COLUMN read_at TIMESTAMP,
    ADD COLUMN remote_read_at TIMESTAMP,
    ADD COLUMN remote_read_pending BOOLEAN NOT NULL DEFAULT FALSE;

CREATE INDEX idx_support_messages_unread
    ON support_messages (conversation_id) WHERE direction = 'IN' AND read_at IS NULL;
