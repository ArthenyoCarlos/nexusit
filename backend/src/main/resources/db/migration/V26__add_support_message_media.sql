ALTER TABLE support_messages
    ADD COLUMN media_bytes BYTEA,
    ADD COLUMN media_filename VARCHAR(255),
    ADD COLUMN media_mime VARCHAR(128),
    ADD COLUMN media_kind VARCHAR(32),
    ADD COLUMN transcription TEXT;

CREATE INDEX idx_support_messages_media_kind ON support_messages(media_kind);
