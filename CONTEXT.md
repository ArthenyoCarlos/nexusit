# NexusIT Panel — Contexto Completo do Projeto

## Visão Geral

Painel administrativo web centralizado para equipe de TI interna.
Empresa de médio porte (~300 funcionários), time de TI com 2 pessoas.
Objetivo: eliminar dependência de conhecimento informal sobre a infraestrutura.

## Stack Tecnológica

### Backend
- Java 21
- Spring Boot 3.x
- Spring Security (JWT — jjwt 0.13.0)
- Spring Data JPA + Hibernate
- PostgreSQL 16
- Flyway (migrações)
- Lombok
- MapStruct
- OpenAPI / Springdoc

### Frontend
- React + Vite
- Tailwind CSS
- Axios
- Recharts (gráficos Zabbix)
- React Router

### Infraestrutura
- Docker Compose (mesma VM do Zabbix)
- Nginx (reverse proxy + serve do frontend)
- Containers: nexusit-db, nexusit-backend, nexusit-frontend

## Estrutura de Pastas Esperada

```
/nexusit
├── backend/
│   ├── src/main/java/br/com/nexusit/
│   │   ├── auth/
│   │   ├── user/
│   │   ├── system/
│   │   ├── monitoring/
│   │   ├── glpi/
│   │   ├── notes/
│   │   ├── planning/
│   │   ├── inventory/
│   │   ├── network/
│   │   └── dashboard/
│   ├── src/main/resources/
│   │   ├── db/migration/
│   │   └── application.yml
│   └── pom.xml
├── frontend/
│   ├── src/
│   │   ├── pages/
│   │   ├── components/
│   │   ├── services/
│   │   └── hooks/
│   └── package.json
├── docker-compose.yml
├── nginx.conf
└── CONTEXT.md
```

## Perfis de Usuário

- **ADMIN** — acesso total, gerencia usuários, configurações e integrações
- **TECHNICIAN** — acesso operacional, visualiza tudo, cria anotações e tarefas

## Módulos

### 1. Auth
- Login com email + senha
- JWT com expiração de 8 horas
- Refresh token
- Rotas públicas: POST /api/auth/login, GET /dashboard/tv

### 2. Catálogo de Sistemas
- CRUD completo de sistemas internos e externos
- Campos: nome, url, descrição, categoria, responsável, servidor (FK inventory), status, documentação (texto livre)
- Categorias: ERP, CRM, Interno, Cloud, Monitoramento, Outro

### 3. Monitoramento (Zabbix)
- Consome API REST do Zabbix (já operacional em Docker)
- Exibe: hosts com status up/down, uptime, CPU%, memória%, alertas por severidade, histórico de problemas
- Auto-refresh configurável (padrão: 60 segundos)
- Endpoint Zabbix: configurável via application.yml (ZABBIX_API_URL, ZABBIX_USER, ZABBIX_PASSWORD)

### 4. Dashboard TV
- URL dedicada: /dashboard/tv
- Sem autenticação (token simples em query param opcional)
- Modo kiosk: sem navbar, sem interação
- Exibe: hosts críticos, alertas ativos, chamados GLPI abertos, uptime servidores, status links
- Auto-refresh: 30 segundos
- Cache local do último estado para resiliência

### 5. GLPI — Chamados
- Consome API REST do GLPI
- Lista chamados abertos, detalhe, responder, fechar, atribuir
- GLPI_API_URL configurável via application.yml
- MVP: só leitura (listar + detalhar). Ações (responder/fechar) na Fase 4.

### 6. Anotações
- Visibilidade: PERSONAL (só o autor) ou SHARED (toda equipe)
- Tags e categorias livres
- Busca por tag, categoria e conteúdo
- Editor markdown simples

### 7. Planejamento
- Kanban com colunas: Backlog, Em andamento, Em revisão, Concluído (customizáveis)
- Calendário de tarefas e manutenções
- Ferramenta própria, sem integração externa

### 8. Inventário de Hardware
- Equipamentos: computador, servidor, switch, roteador, impressora, nobreak, outro
- Campos: nome, tipo, marca, modelo, número de série, localização, responsável (FK user), data de compra, status, observações
- Vinculado ao catálogo de sistemas (servidor X roda sistema Y)

### 9. Documentação de Rede
- Seções: Topologia, Endereçamento IP, VLANs, Equipamentos, Runbooks, Outros
- Conteúdo em markdown
- Histórico de quem editou por último

## Entidades do Banco de Dados

```sql
-- users
id UUID PK, name VARCHAR, email VARCHAR UNIQUE, password_hash VARCHAR,
role ENUM(ADMIN, TECHNICIAN), active BOOLEAN, created_at TIMESTAMP

-- systems
id UUID PK, name VARCHAR, url VARCHAR, description TEXT, category VARCHAR,
server_id UUID FK(inventory_items), responsible_id UUID FK(users),
status ENUM(ACTIVE, INACTIVE), documentation TEXT, created_at TIMESTAMP

-- inventory_items
id UUID PK, name VARCHAR, type VARCHAR, brand VARCHAR, model VARCHAR,
serial_number VARCHAR, location VARCHAR, responsible_id UUID FK(users),
purchase_date DATE, status ENUM(ACTIVE, INACTIVE, MAINTENANCE), notes TEXT

-- notes
id UUID PK, title VARCHAR, content TEXT, visibility ENUM(PERSONAL, SHARED),
author_id UUID FK(users), created_at TIMESTAMP, updated_at TIMESTAMP

-- note_tags
id UUID PK, note_id UUID FK(notes), tag VARCHAR, category VARCHAR

-- planning_tasks
id UUID PK, title VARCHAR, description TEXT, column_name VARCHAR,
column_order INT, due_date DATE, assignee_id UUID FK(users),
created_at TIMESTAMP, updated_at TIMESTAMP

-- network_docs
id UUID PK, title VARCHAR, section VARCHAR, content TEXT,
updated_by UUID FK(users), updated_at TIMESTAMP
```

## Segurança

- Senhas: bcrypt strength 12
- JWT secret: variável de ambiente JWT_SECRET (mínimo 256 bits)
- HTTPS via Nginx (certificado autoassinado no MVP)
- Todas as rotas /api/** protegidas exceto /api/auth/login
- /dashboard/tv público (sem JWT)

## Variáveis de Ambiente (docker-compose)

```
DB_HOST=nexusit-db
DB_PORT=5432
DB_NAME=nexusit
DB_USER=nexusit
DB_PASSWORD=<senha>
JWT_SECRET=<secret_256bits>
JWT_EXPIRATION=28800000
ZABBIX_API_URL=http://<ip_zabbix>/api_jsonrpc.php
ZABBIX_USER=<user>
ZABBIX_PASSWORD=<senha>
GLPI_API_URL=http://<ip_glpi>/apirest.php
GLPI_APP_TOKEN=<token>
GLPI_USER_TOKEN=<token>
```

## Roadmap de Fases

| Fase | Conteúdo | Semanas |
|------|----------|---------|
| 1 | Estrutura base, Docker, Auth JWT, layout | 1–2 |
| 2 | Catálogo de Sistemas + Inventário | 3–4 |
| 3 | Zabbix + Dashboard TV | 5–6 |
| 4 | GLPI Chamados | 7 |
| 5 | Anotações + Planejamento (Kanban) | 8–9 |
| 6 | Documentação de Rede + Refinamentos | 10 |
