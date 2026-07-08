ALTER TABLE users
    ADD COLUMN job_title VARCHAR(120);

UPDATE users
SET job_title = CASE
    WHEN role = 'ADMIN' THEN 'Administrador(a)'
    ELSE 'Técnico(a)'
END
WHERE job_title IS NULL OR job_title = '';
