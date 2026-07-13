ALTER TABLE ssh_hosts
    ADD COLUMN IF NOT EXISTS auth_type VARCHAR(30) NOT NULL DEFAULT 'PASSWORD',
    ADD COLUMN IF NOT EXISTS encrypted_private_key TEXT,
    ADD COLUMN IF NOT EXISTS encrypted_private_key_passphrase TEXT;

ALTER TABLE ssh_hosts
    ALTER COLUMN encrypted_password DROP NOT NULL;

UPDATE ssh_hosts
SET auth_type = 'PASSWORD'
WHERE auth_type IS NULL;
