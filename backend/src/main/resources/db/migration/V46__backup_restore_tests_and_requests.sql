CREATE TABLE IF NOT EXISTS backup_restore_tests (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    job_id UUID NOT NULL REFERENCES backup_jobs(id) ON DELETE CASCADE,
    status VARCHAR(40) NOT NULL,
    tested_at TIMESTAMP NOT NULL DEFAULT NOW(),
    duration_seconds INTEGER,
    tested_artifact_ref VARCHAR(500),
    message TEXT,
    validated_by VARCHAR(160),
    created_at TIMESTAMP NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS backup_action_requests (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    job_id UUID NOT NULL REFERENCES backup_jobs(id) ON DELETE CASCADE,
    action VARCHAR(40) NOT NULL,
    status VARCHAR(40) NOT NULL DEFAULT 'QUEUED',
    requested_by VARCHAR(160),
    requested_at TIMESTAMP NOT NULL DEFAULT NOW(),
    started_at TIMESTAMP,
    finished_at TIMESTAMP,
    result_message TEXT,
    created_at TIMESTAMP NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMP NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_backup_restore_tests_job_tested ON backup_restore_tests(job_id, tested_at DESC);
CREATE INDEX IF NOT EXISTS idx_backup_action_requests_status ON backup_action_requests(status, requested_at);
CREATE INDEX IF NOT EXISTS idx_backup_action_requests_job ON backup_action_requests(job_id, requested_at DESC);
