CREATE TABLE planning_task_members (
    id      UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    task_id UUID NOT NULL REFERENCES planning_tasks(id) ON DELETE CASCADE,
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    UNIQUE (task_id, user_id)
);

CREATE INDEX idx_planning_task_members_task ON planning_task_members(task_id);
