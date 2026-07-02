CREATE TABLE termo_templates (
    id UUID PRIMARY KEY,
    nome VARCHAR(120) NOT NULL,
    clausulas TEXT NOT NULL,
    logo_url TEXT,
    logo_position VARCHAR(30) NOT NULL DEFAULT 'TOPO_CENTRO',
    created_at TIMESTAMP NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMP NOT NULL DEFAULT NOW()
);

CREATE TABLE termos_responsabilidade (
    id UUID PRIMARY KEY,
    numero_termo VARCHAR(20) NOT NULL UNIQUE,
    responsavel_nome VARCHAR(180) NOT NULL,
    cpf VARCHAR(20),
    cargo VARCHAR(120),
    setor VARCHAR(120),
    data_entrega DATE NOT NULL,
    tipo_equipamento VARCHAR(100) NOT NULL,
    marca VARCHAR(100),
    modelo VARCHAR(140),
    numero_serie VARCHAR(140),
    tombamento VARCHAR(20) NOT NULL UNIQUE,
    condicao_inicial TEXT,
    observacoes TEXT,
    acessorios_json TEXT,
    status VARCHAR(20) NOT NULL DEFAULT 'ATIVO',
    assinatura_digital TEXT,
    data_hora_assinatura TIMESTAMP,
    ip_assinante VARCHAR(80),
    hash_documento VARCHAR(128),
    template_id UUID REFERENCES termo_templates(id),
    created_at TIMESTAMP NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMP NOT NULL DEFAULT NOW()
);

CREATE TABLE ocorrencias_termo (
    id UUID PRIMARY KEY,
    termo_id UUID NOT NULL REFERENCES termos_responsabilidade(id) ON DELETE CASCADE,
    data TIMESTAMP NOT NULL DEFAULT NOW(),
    tipo VARCHAR(40) NOT NULL,
    descricao TEXT NOT NULL,
    pecas_substituidas TEXT,
    custo NUMERIC(12,2),
    responsabilidade VARCHAR(30),
    registrado_por VARCHAR(160),
    created_at TIMESTAMP NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_termos_numero ON termos_responsabilidade(numero_termo);
CREATE INDEX idx_termos_tombamento ON termos_responsabilidade(tombamento);
CREATE INDEX idx_termos_status ON termos_responsabilidade(status);
CREATE INDEX idx_ocorrencias_termo ON ocorrencias_termo(termo_id);

INSERT INTO termo_templates (id, nome, clausulas, logo_url, logo_position)
VALUES (
    gen_random_uuid(),
    'Template padrão',
    '1. O responsável declara receber o equipamento descrito neste termo em perfeitas condições de uso, comprometendo-se a conservá-lo e utilizá-lo exclusivamente para atividades profissionais relacionadas à empresa.\n\n2. O responsável responderá por danos causados por mau uso, negligência, imprudência, instalação de aplicativos não autorizados, quedas, líquidos, violações físicas ou qualquer conduta em desacordo com as políticas internas de TI.\n\n3. No desligamento, transferência de setor, substituição do equipamento ou quando solicitado pela empresa, o responsável deverá devolver imediatamente o equipamento, seus acessórios e credenciais associadas.\n\n4. É proibido o uso pessoal excessivo, compartilhamento com terceiros, empréstimo, cessão ou utilização para fins alheios às atividades da empresa, salvo autorização expressa da gestão.\n\n5. Em caso de perda ou roubo, o responsável deverá comunicar imediatamente a empresa e apresentar boletim de ocorrência. A ausência de boletim ou indícios de negligência poderão caracterizar responsabilidade do funcionário pelos prejuízos.\n\n6. O responsável declara ciência e aceite das políticas de segurança da informação, uso aceitável, confidencialidade, proteção de dados e demais normas de TI da empresa.\n\n7. A assinatura digital deste termo possui validade para comprovar ciência, aceite e recebimento do equipamento e acessórios aqui descritos.',
    NULL,
    'TOPO_CENTRO'
);
