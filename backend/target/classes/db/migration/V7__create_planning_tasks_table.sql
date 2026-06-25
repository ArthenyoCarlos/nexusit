CREATE TABLE planning_tasks (
    id            UUID         PRIMARY KEY DEFAULT gen_random_uuid(),
    title         VARCHAR(255) NOT NULL,
    description   TEXT,
    column_name   VARCHAR(100) NOT NULL DEFAULT 'Backlog',
    column_order  INT          NOT NULL DEFAULT 0,
    due_date      DATE,
    assignee_id   UUID         REFERENCES users(id),
    created_at    TIMESTAMP    NOT NULL DEFAULT now(),
    updated_at    TIMESTAMP    NOT NULL DEFAULT now()
);
