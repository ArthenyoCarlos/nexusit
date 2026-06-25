CREATE EXTENSION IF NOT EXISTS "pgcrypto";

CREATE TYPE user_role AS ENUM ('ADMIN', 'TECHNICIAN');

CREATE TABLE users (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name VARCHAR(255) NOT NULL,
    email VARCHAR(255) NOT NULL UNIQUE,
    password_hash VARCHAR(255) NOT NULL,
    role user_role NOT NULL DEFAULT 'TECHNICIAN',
    active BOOLEAN NOT NULL DEFAULT TRUE,
    created_at TIMESTAMP NOT NULL DEFAULT NOW()
);

-- Seed admin user: password = "admin123" (bcrypt strength 12)
INSERT INTO users (name, email, password_hash, role, active)
VALUES (
    'Administrador',
    'admin@nexusit.local',
    '$2b$12$HIUZJ.sDpNLDRQh1jzGTAO0vOc3MiNUdyHZlHymkeOlImjFkkuBC.',
    'ADMIN',
    TRUE
);
