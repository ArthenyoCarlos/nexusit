# CRM WhatsApp — leitura, áudios longos e interface

## Sintoma e causa
- Conversas abertas não tinham rotina explícita de leitura no CRM/WhatsApp.
- Uploads acima do limite padrão de aproximadamente 1 MB eram bloqueados pelos proxies/Spring.
- A resposta humana era registrada antes de confirmar o envio; o cliente best-effort podia esconder falhas.
- O conversor lia o pipe antes do timeout e fazia fallback silencioso para o áudio original.

## Correções
- Interface semelhante ao WhatsApp Web: busca, filtros, badges, bolhas, horários, tema, composer e navegação mobile, preservando os controles de chamados/técnicos/GLPI.
- POST autenticado `/api/support/{id}/read` com cursor da entrada exibida. GET e polling não confirmam leitura sozinhos; aba oculta/rolagem fora do fim não marcam entradas novas.
- Leitura local (`read_at`) separada da confirmação remota (`remote_read_at`). IDs e JIDs originais preservados a partir dos novos webhooks. Falhas remotas ficam pendentes, sem confirmação fictícia.
- Entradas históricas sem identidade e JIDs `@lid` não suportados pelo handler Evolution instalado ficam sem confirmação remota. Não substituir JID por telefone adivinhado. Os campos da migration V50 são aditivos e não apagam histórico.
- Entrada até **32 MiB por arquivo**, requisição multipart até 34 MiB; áudio convertido até **16 MiB**. Limites por tamanho, não por minutos.
- Áudio convertido localmente em OGG/Opus com timeout efetivo e sem fallback silencioso. Upload com progresso/processamento; falhas preservam rascunho. Texto e áudio são enviados separadamente para evitar entrega parcial/duplicação.
- Respostas humanas são salvas como enviadas após ACK `key.id` do gateway; isso não significa entregue/lido pelo destinatário. Não há reenvio automático em timeout/resultado incerto.
- Erros multipart recebem 413 com orientação, sem despacho de erro virar 401/logout. Erros operacionais usam `ProblemDetail.detail` sanitizado.

## Proxy e tempos
- `/opt/apps/nexusit/nginx.conf`: rota `/api/support/`, body 34m, read timeout 300s.
- `/opt/reverse-proxy/nginx/conf.d/nexusit.conf`: mesma rota/body, read timeout 330s; configuração externa ao repositório.
- Spring `max-file-size: 32MB`, `max-request-size: 34MB`; cliente upload 360s, conversor e transporte de mídia até 120s cada.
- A alteração de proxy externo precisa ser preservada em futuras reinstalações; validar `nginx -t` e reload. Demais rotas não tiveram o limite de corpo aumentado.

## Verificação executada
- **108 testes backend**, sem falhas/erros/pulos, incluindo autenticação, cursor, ACKs, falha GLPI, limites e timeout do conversor.
- **14 testes de frontend**, build isolado e build Docker aprovados.
- Browserfixture fail-closed: visibilidade/scroll/idempotência de leitura, respostas atrasadas, falhas polling, 413 sem reenvio, rascunho preservado, áudio+texto bloqueado antes do upload, microfone simulado/pré-escuta/cancelamento, desktop/mobile/tema sem erros JS.
- Conversor Java real: fixture WAV de **600 s**, **26.460.078 bytes**, saída OGG/Opus **3.381.480 bytes**, duração **600,0065 s**, 48 kHz mono; conferida por ffprobe, sem truncamento.
- Produção: uploads de 128 B, 1,1 MB e 26.460.078 B passaram pelas camadas até atendimento inexistente (404 esperado, sem enviar); 33/35 MiB rejeitados com 413, não 401.
- Migration V50 aplicada; contagens de 411 conversas e 18.483 mensagens preservadas na validação. Monitoramento, GLPI e painel TS responderam HTTP 200 após publicação.
- **Nenhum envio ou recibo de leitura para contatos reais foi usado na validação.** Aceitação/entrega efetiva no WhatsApp requer teste operacional com contato autorizado.

## Backup / rollback
- Backup completo antes da migration: `/home/galdino/.hermes/state/nexusit-crm-backups/before-crm-final.dump`, acesso restrito. Também há schema/config do proxy anteriores.
- Imagens anteriores: `nexusit-backend:before-crm-whatsapp` e `nexusit-frontend:before-crm-whatsapp`. Reetiquetar para as tags do Compose e recriar somente os serviços da aplicação se necessário.
- A migration é aditiva; rollback da aplicação não deve apagar os novos campos ou histórico.
