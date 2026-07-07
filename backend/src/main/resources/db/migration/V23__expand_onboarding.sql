ALTER TABLE onboarding_checklists
    ADD COLUMN status VARCHAR(20) NOT NULL DEFAULT 'IN_PROGRESS',
    ADD COLUMN completed_at TIMESTAMP,
    ADD COLUMN employee_user_id UUID REFERENCES users(id) ON DELETE SET NULL,
    ADD COLUMN inventory_item_id UUID REFERENCES inventory_items(id) ON DELETE SET NULL;

ALTER TABLE onboarding_checklists
    ADD CONSTRAINT chk_onboarding_type CHECK (type IN ('ONBOARDING', 'OFFBOARDING'));

ALTER TABLE onboarding_checklists
    ADD CONSTRAINT chk_onboarding_status CHECK (status IN ('IN_PROGRESS', 'COMPLETED', 'CANCELLED'));

ALTER TABLE onboarding_checklist_items
    ADD COLUMN due_date DATE,
    ADD COLUMN assigned_to UUID REFERENCES users(id) ON DELETE SET NULL;

CREATE TABLE onboarding_checklist_templates (
    id         UUID         PRIMARY KEY DEFAULT gen_random_uuid(),
    type       VARCHAR(20)  NOT NULL,
    name       VARCHAR(255) NOT NULL,
    active     BOOLEAN      NOT NULL DEFAULT TRUE,
    created_at TIMESTAMP    NOT NULL DEFAULT NOW(),
    CONSTRAINT chk_template_type CHECK (type IN ('ONBOARDING', 'OFFBOARDING'))
);

CREATE TABLE onboarding_checklist_template_items (
    id          UUID         PRIMARY KEY DEFAULT gen_random_uuid(),
    template_id UUID         NOT NULL REFERENCES onboarding_checklist_templates(id) ON DELETE CASCADE,
    title       VARCHAR(255) NOT NULL,
    description TEXT,
    item_order  INTEGER      NOT NULL DEFAULT 0
);

CREATE INDEX idx_template_items_template ON onboarding_checklist_template_items(template_id);

INSERT INTO onboarding_checklist_templates (id, type, name) VALUES
    ('11111111-1111-1111-1111-111111111111', 'ONBOARDING', 'Padrão'),
    ('22222222-2222-2222-2222-222222222222', 'OFFBOARDING', 'Padrão');

INSERT INTO onboarding_checklist_template_items (template_id, title, item_order) VALUES
    ('11111111-1111-1111-1111-111111111111', 'Criar conta de e-mail corporativo', 0),
    ('11111111-1111-1111-1111-111111111111', 'Configurar VPN de acesso', 1),
    ('11111111-1111-1111-1111-111111111111', 'Entregar notebook/computador', 2),
    ('11111111-1111-1111-1111-111111111111', 'Instalar softwares necessários', 3),
    ('11111111-1111-1111-1111-111111111111', 'Conceder acesso ao sistema ERP', 4),
    ('11111111-1111-1111-1111-111111111111', 'Configurar ramal telefônico', 5),
    ('11111111-1111-1111-1111-111111111111', 'Adicionar ao grupo de e-mail da equipe', 6),
    ('11111111-1111-1111-1111-111111111111', 'Cadastrar no sistema de ponto', 7),
    ('22222222-2222-2222-2222-222222222222', 'Revogar acesso ao e-mail corporativo', 0),
    ('22222222-2222-2222-2222-222222222222', 'Remover acesso à VPN', 1),
    ('22222222-2222-2222-2222-222222222222', 'Recolher notebook/computador', 2),
    ('22222222-2222-2222-2222-222222222222', 'Recolher crachá e equipamentos', 3),
    ('22222222-2222-2222-2222-222222222222', 'Revogar acesso ao sistema ERP', 4),
    ('22222222-2222-2222-2222-222222222222', 'Fazer backup dos dados do usuário', 5),
    ('22222222-2222-2222-2222-222222222222', 'Transferir arquivos e responsabilidades', 6),
    ('22222222-2222-2222-2222-222222222222', 'Cancelar ramal telefônico', 7);
