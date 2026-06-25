# NexusIT Panel — Prompts para Claude Code

> Cole cada prompt no Claude Code na ordem das fases.
> Sempre leia o CONTEXT.md antes de iniciar uma fase nova.

---

## FASE 1 — Base do projeto, Docker e Autenticação JWT

```
Leia o arquivo CONTEXT.md nesta pasta e implemente a Fase 1 do projeto NexusIT Panel.

Tarefas desta fase:

1. Crie o docker-compose.yml com três serviços:
   - nexusit-db: PostgreSQL 16, porta 5432, volume persistente
   - nexusit-backend: Spring Boot, porta 8080, depende do db
   - nexusit-frontend: Nginx servindo build React, porta 80
   Use variáveis de ambiente conforme descrito no CONTEXT.md.

2. Crie o projeto Maven no diretório /backend com groupId br.com.nexusit, artifactId nexusit-backend.
   Dependências: spring-boot-starter-web, spring-boot-starter-security,
   spring-boot-starter-data-jpa, postgresql, flyway-core, lombok,
   jjwt-api 0.13.0, jjwt-impl 0.13.0, jjwt-jackson 0.13.0,
   springdoc-openapi-starter-webmvc-ui 2.3.0, mapstruct 1.6.3.

3. Configure application.yml com datasource, jpa, flyway e as
   variáveis de ambiente do CONTEXT.md.

4. Crie a entidade User com os campos do CONTEXT.md, enum Role (ADMIN, TECHNICIAN).

5. Crie o migration Flyway V1__create_users_table.sql.

6. Implemente autenticação JWT completa:
   - JwtService (gerar, validar, extrair claims)
   - JwtAuthenticationFilter
   - SecurityConfig (rotas públicas: POST /api/auth/login)
   - AuthController com POST /api/auth/login retornando { token, refreshToken, user }
   - UserDetailsService carregando por email

7. Crie o projeto React com Vite no diretório /frontend:
   npm create vite@latest frontend -- --template react
   Instale: tailwindcss, axios, react-router-dom.

8. Implemente no frontend:
   - Tela de login (email + senha)
   - Contexto de autenticação (AuthContext)
   - Interceptor Axios adicionando Bearer token
   - Rota protegida (redireciona para login se sem token)
   - Layout base com sidebar de navegação (links para os módulos futuros)

9. Crie o nginx.conf fazendo proxy de /api/* para o backend.

Ao final, o sistema deve: subir com docker-compose up, exibir tela de login,
autenticar e mostrar o layout com sidebar.
```

---

## FASE 2 — Catálogo de Sistemas e Inventário de Hardware

```
Leia o CONTEXT.md. Implemente a Fase 2 do NexusIT Panel.
A Fase 1 já está implementada (auth JWT, layout, Docker funcionando).

Tarefas:

1. Backend — Módulo de Sistemas:
   - Entidade System com todos os campos do CONTEXT.md
   - Migration V2__create_systems_table.sql
   - SystemRepository, SystemService, SystemController
   - Endpoints: GET /api/systems, POST /api/systems, PUT /api/systems/{id},
     DELETE /api/systems/{id}, GET /api/systems/{id}
   - Filtro por categoria e status
   - Apenas ADMIN pode criar/editar/deletar. TECHNICIAN só lê.

2. Backend — Módulo de Inventário:
   - Entidade InventoryItem com todos os campos do CONTEXT.md
   - Migration V3__create_inventory_items_table.sql
   - InventoryItemRepository, InventoryItemService, InventoryItemController
   - Endpoints: GET /api/inventory, POST /api/inventory,
     PUT /api/inventory/{id}, DELETE /api/inventory/{id}
   - Filtro por tipo e status

3. Frontend — Página de Sistemas:
   - Listagem em grid com cards (nome, categoria, status, botão de acesso)
   - Clique no card abre a URL do sistema em nova aba
   - Formulário modal para criar/editar (só visível para ADMIN)
   - Badge de status colorido (verde=ativo, cinza=inativo)
   - Filtro por categoria

4. Frontend — Página de Inventário:
   - Listagem em tabela (nome, tipo, modelo, localização, responsável, status)
   - Formulário modal para criar/editar
   - Filtro por tipo e status
   - Campo de busca por nome ou número de série

Mantenha consistência visual com o layout da Fase 1.
```

---

## FASE 3 — Monitoramento Zabbix e Dashboard TV

```
Leia o CONTEXT.md. Implemente a Fase 3 do NexusIT Panel.
Fases 1 e 2 já implementadas.

Tarefas:

1. Backend — Integração Zabbix:
   - ZabbixClient: serviço que faz chamadas para a API JSON-RPC do Zabbix
     usando as variáveis ZABBIX_API_URL, ZABBIX_USER, ZABBIX_PASSWORD
   - Autenticação no Zabbix via método user.login, cache do auth token
   - ZabbixService com métodos:
     * getHosts() — lista hosts com status e interfaces
     * getProblems() — problemas ativos com severidade
     * getHostUptime(hostId) — uptime do host
     * getHostMetrics(hostId) — CPU% e memória% via items
     * getRecentHistory(hours) — histórico de problemas últimas N horas
   - ZabbixController com endpoints:
     GET /api/monitoring/hosts
     GET /api/monitoring/problems
     GET /api/monitoring/history?hours=24
     GET /api/monitoring/hosts/{id}/metrics

2. Frontend — Página de Monitoramento:
   - Cards de hosts: nome, IP, status (verde/vermelho), uptime
   - Seção de alertas ativos agrupados por severidade (disaster, high, average, warning, info)
   - Gráfico de linha com CPU% do servidor principal (últimas 2 horas) usando Recharts
   - Auto-refresh a cada 60 segundos com indicador visual de última atualização

3. Frontend — Dashboard TV (rota /dashboard/tv):
   - Layout full-screen sem navbar, sem sidebar
   - Fundo escuro (#0f172a)
   - Seção 1: Status dos hosts (grid de cards com nome + ícone verde/vermelho)
   - Seção 2: Contadores de alertas por severidade (números grandes)
   - Seção 3: Problemas ativos (lista com severidade colorida)
   - Auto-refresh: 30 segundos
   - Horário atual no canto superior direito
   - Cache do último estado: se a API falhar, manter dados anteriores com aviso "Última atualização: HH:MM"
   - Rota pública (sem autenticação)

Sevidades Zabbix para cores: disaster=vermelho, high=laranja, average=amarelo, warning=azul, info=cinza.
```

---

## FASE 4 — Integração GLPI (Chamados)

```
Leia o CONTEXT.md. Implemente a Fase 4 do NexusIT Panel.
Fases 1, 2 e 3 já implementadas.

Tarefas:

1. Backend — Integração GLPI:
   - GlpiClient: serviço HTTP que consome a REST API do GLPI
     usando GLPI_API_URL, GLPI_APP_TOKEN, GLPI_USER_TOKEN
   - Autenticação via initSession, cache da session token
   - GlpiService com métodos:
     * getTickets(status) — lista chamados por status
     * getTicketById(id) — detalhe do chamado
     * addFollowup(ticketId, content) — adicionar resposta
     * closeTicket(ticketId) — fechar chamado
     * assignTicket(ticketId, userId) — atribuir técnico
   - GlpiController:
     GET /api/glpi/tickets
     GET /api/glpi/tickets/{id}
     POST /api/glpi/tickets/{id}/followup
     PUT /api/glpi/tickets/{id}/close
     PUT /api/glpi/tickets/{id}/assign

2. Frontend — Página de Chamados:
   - Lista de chamados abertos: título, solicitante, data de abertura,
     prioridade, técnico atribuído, status
   - Cores de prioridade: muito alta=vermelho, alta=laranja, média=amarelo, baixa=azul
   - Modal de detalhe: histórico de followups, formulário para resposta,
     botões Fechar e Atribuir (só ADMIN)
   - Filtro por status e prioridade

3. Dashboard TV — adicionar seção de chamados:
   - Contador de chamados abertos por prioridade
   - Lista dos 5 chamados mais recentes (título + prioridade)
```

---

## FASE 5 — Anotações e Planejamento (Kanban)

```
Leia o CONTEXT.md. Implemente a Fase 5 do NexusIT Panel.
Fases 1 a 4 já implementadas.

Tarefas:

1. Backend — Módulo de Anotações:
   - Entidades Note e NoteTag com campos do CONTEXT.md
   - Migrations V4__create_notes_table.sql e V5__create_note_tags_table.sql
   - NoteService: ao buscar, PERSONAL filtra por author_id == usuário logado;
     SHARED retorna todas
   - NoteController:
     GET /api/notes (próprias + compartilhadas)
     POST /api/notes
     PUT /api/notes/{id} (só o autor pode editar)
     DELETE /api/notes/{id} (só o autor ou ADMIN)
     GET /api/notes/search?q=&tag=&category=

2. Backend — Módulo de Planejamento:
   - Entidade PlanningTask com campos do CONTEXT.md
   - Migration V6__create_planning_tasks_table.sql
   - PlanningTaskController:
     GET /api/planning/tasks
     POST /api/planning/tasks
     PUT /api/planning/tasks/{id}
     PUT /api/planning/tasks/{id}/move (muda column_name e column_order)
     DELETE /api/planning/tasks/{id}

3. Frontend — Página de Anotações:
   - Lista de anotações com badge Personal/Compartilhada
   - Tags exibidas como chips coloridos
   - Filtro por tag, categoria e busca textual
   - Editor markdown com preview lado a lado (use react-md-editor ou similar)
   - Modal para criar/editar

4. Frontend — Página de Planejamento:
   - Kanban com 4 colunas: Backlog, Em andamento, Em revisão, Concluído
   - Cards arrastáveis entre colunas (use @dnd-kit/core)
   - Cada card: título, responsável, data limite (badge vermelho se vencido)
   - Calendário mensal (use react-calendar) mostrando tarefas com due_date
   - Modal para criar/editar tarefa
```

---

## FASE 6 — Documentação de Rede e Refinamentos

```
Leia o CONTEXT.md. Implemente a Fase 6 do NexusIT Panel.
Fases 1 a 5 já implementadas.

Tarefas:

1. Backend — Módulo de Documentação de Rede:
   - Entidade NetworkDoc com campos do CONTEXT.md
   - Migration V7__create_network_docs_table.sql
   - Seções fixas: Topologia, Endereçamento IP, VLANs, Equipamentos, Runbooks, Outros
   - NetworkDocController:
     GET /api/network-docs
     GET /api/network-docs/{id}
     POST /api/network-docs
     PUT /api/network-docs/{id}
     DELETE /api/network-docs/{id}

2. Frontend — Página de Documentação:
   - Sidebar interna com as seções
   - Conteúdo markdown com renderização (use react-markdown)
   - Botão Editar abre editor markdown inline
   - Exibe "Última edição por [nome] em [data]"

3. Refinamentos gerais:
   - Página de perfil do usuário (alterar nome e senha)
   - Página de configurações (só ADMIN): gerenciar usuários,
     configurar URLs do Zabbix e GLPI, intervalo de refresh
   - Notificação toast quando novo problema Zabbix com severidade
     disaster ou high aparecer (polling a cada 60s)
   - Favicon e título da aba: "NexusIT Panel"
   - Loading skeletons nas páginas que consomem API externa
   - Página 404 personalizada
   - Testes básicos: ao menos um teste de integração por controller
```

---

## DICAS GERAIS PARA O CLAUDE CODE

- Sempre diga qual fase está implementando no início do prompt
- Se algo der erro, cole a mensagem de erro completa e peça para corrigir
- Para testar a integração Zabbix sem o servidor real, peça para criar um ZabbixClientMock
- Para o Dashboard TV, peça para testar em modo tela cheia com F11 no Chrome
- Se quiser começar pela tela antes do backend, diga: "implemente só o frontend com dados mockados por enquanto"
