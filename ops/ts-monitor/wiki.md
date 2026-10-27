# Monitoramento de sessões TS — desconexão e logoff

## Objetivo
Acompanhar o TS `192.168.2.100` / `TS-VM` no NexusIT, sem encerrar sessões. Regra operacional informada: usuários não administradores desconectados por mais de 30 minutos devem sofrer logoff pelo Windows. Sessão ativa e tempo ocioso não são o alvo dessa regra.

## Implementação
- Painel: `/monitoring/ts`, no menu Monitoramento → Sessões TS.
- API: `GET /api/monitoring/ts-sessions`, autenticada, somente leitura e sem cache.
- Coleta WinRM com NTLM e criptografia de mensagens obrigatória; credencial do registro **TS** do cofre NexusIT, descriptografada apenas em memória.
- Script executado em memória no Windows. Nenhum agente adicional, tarefa agendada, regra de firewall ou política Windows foi instalado/modificado. O bloqueio de `system.run` do Zabbix foi preservado.
- Coleta a cada minuto, painel consulta a cada 30 segundos. Tolerância operacional de 2 minutos após o limite para evitar alertas por atraso de coleta/processamento.

## Dados e evidências
- WTS API: usuário/domínio, ID de sessão, estado, horário de logon, horário real de desconexão, tempo desconectado, nome/IP do cliente quando disponível.
- Identificação administrativa pelo SID do grupo local Administradores e grupos de autorização. Quando não é possível determinar a associação, o painel informa desconhecido e não presume violação.
- Eventos Windows TerminalServices LocalSessionManager: 21 logon, 23 logoff, 24 desconexão e 25 reconexão.
- Logoff só é confirmado por evento real; o desaparecimento de uma sessão entre coletas não é prova. Um evento de logoff não identifica sozinho se a causa foi a política de timeout.
- A cada coleta são consultados até 500 eventos das últimas 24 horas; armazenamento local deduplicado por servidor/RecordId, retenção de 30 dias e últimos 1000 eventos no painel.

## Saúde da coleta
`ts_sessions.json` é publicado atomicamente em `/home/galdino/.hermes/state`; o histórico fica em `ts_sessions_history.sqlite`. Em falha, o último dado é preservado e marcado como erro. Dados antigos/indisponíveis não significam zero usuários nem conformidade. O serviço invalida conformidade de snapshots antigos.

O watchdog script-only é silencioso quando saudável. Avisa sobre nova sessão acima do prazo, saída da condição de violação, falha de coleta e recuperação; não cria chamados nem executa logoff.

## Política efetiva e limitações
Valores do registro de máquina/listener e de usuário são observações auxiliares, não substituem `gpresult`/RSOP. `userMaxDisconnectionTimeMs=null` significa apenas que esse valor não foi encontrado no caminho consultado. Associação ao grupo Administradores expressa a exceção operacional solicitada, mas não comprova o filtro de aplicação da GPO.

Para validar a regra ponta a ponta, usar uma sessão de teste autorizada: conectar → desconectar → observar o limite e evento de logoff. Não desconectar usuários reais para teste. Até esse teste, o monitoramento pode estar operacional sem que a aplicação da política em todos os usuários esteja certificada.

## Manutenção e rollback
Código e instruções: `/opt/apps/nexusit/ops/ts-monitor/`. Dependências em venv `~/.hermes/venvs/ts-monitor`. Agendamento Hermes: **TS sessões — coleta e watchdog de logoff**, wrapper `~/.hermes/scripts/ts_sessions_watchdog.sh`.

A rotação da senha deve ser feita no registro existente TS do cofre. Se o registro for excluído/recriado, atualizar o UUID fixado no coletor após conferir o destino.

Para desativar, pausar o agendamento e remover/reverter o painel/API se desejado. Não há alterações Windows para desfazer. Preservar o histórico se necessário para auditoria.
