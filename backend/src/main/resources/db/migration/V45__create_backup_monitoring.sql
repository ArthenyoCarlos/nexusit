CREATE TABLE IF NOT EXISTS backup_jobs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name VARCHAR(160) NOT NULL,
    system_name VARCHAR(120) NOT NULL,
    source_type VARCHAR(40) NOT NULL,
    source_ref VARCHAR(500),
    target_ref VARCHAR(500),
    schedule_label VARCHAR(160),
    expected_frequency_minutes INTEGER NOT NULL DEFAULT 1440,
    stale_after_minutes INTEGER NOT NULL DEFAULT 1560,
    enabled BOOLEAN NOT NULL DEFAULT TRUE,
    owner VARCHAR(120),
    notes TEXT,
    created_at TIMESTAMP NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMP NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS backup_runs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    job_id UUID NOT NULL REFERENCES backup_jobs(id) ON DELETE CASCADE,
    status VARCHAR(40) NOT NULL,
    started_at TIMESTAMP,
    finished_at TIMESTAMP NOT NULL DEFAULT NOW(),
    duration_seconds INTEGER,
    size_bytes BIGINT,
    artifact_ref VARCHAR(500),
    message TEXT,
    created_at TIMESTAMP NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_backup_jobs_enabled ON backup_jobs(enabled);
CREATE INDEX IF NOT EXISTS idx_backup_jobs_system ON backup_jobs(system_name);
CREATE INDEX IF NOT EXISTS idx_backup_runs_job_finished ON backup_runs(job_id, finished_at DESC);
CREATE INDEX IF NOT EXISTS idx_backup_runs_status ON backup_runs(status);

INSERT INTO backup_jobs (name, system_name, source_type, source_ref, target_ref, schedule_label, expected_frequency_minutes, stale_after_minutes, owner, notes)
SELECT 'NexusIT PostgreSQL', 'NexusIT', 'POSTGRES', 'nexusit-db:nexusit', '/opt/backups/nexusit/postgres', 'Diário', 1440, 1560, 'TI', 'Banco principal do NexusIT'
WHERE NOT EXISTS (SELECT 1 FROM backup_jobs WHERE name = 'NexusIT PostgreSQL');

INSERT INTO backup_jobs (name, system_name, source_type, source_ref, target_ref, schedule_label, expected_frequency_minutes, stale_after_minutes, owner, notes)
SELECT 'FrotaPRO PostgreSQL', 'FrotaPRO', 'POSTGRES', '192.168.2.245:frotapro-db/frotapro', '/opt/backups/frotapro/postgres', 'Diário', 1440, 1560, 'TI', 'Banco principal do FrotaPRO'
WHERE NOT EXISTS (SELECT 1 FROM backup_jobs WHERE name = 'FrotaPRO PostgreSQL');
