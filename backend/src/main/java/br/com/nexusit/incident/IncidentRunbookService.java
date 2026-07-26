package br.com.nexusit.incident;

import lombok.RequiredArgsConstructor;
import org.springframework.security.core.Authentication;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.net.InetAddress;
import java.net.InetSocketAddress;
import java.net.Socket;
import java.text.Normalizer;
import java.time.LocalDateTime;
import java.util.*;

@Service
@RequiredArgsConstructor
@Transactional(readOnly = true)
public class IncidentRunbookService {
    private final CorrelatedIncidentRepository incidentRepository;
    private final IncidentActionResultRepository resultRepository;

    public IncidentRunbookResponse get(UUID incidentId) {
        CorrelatedIncident incident = incidentRepository.findById(incidentId).orElseThrow();
        return buildForIncident(incident, recent(incidentId));
    }

    public IncidentRunbookResponse build(CorrelatedIncident incident) {
        return buildForIncident(incident, List.of());
    }

    public static IncidentRunbookResponse buildForIncident(CorrelatedIncident incident) {
        return buildForIncident(incident, List.of());
    }

    private static IncidentRunbookResponse buildForIncident(CorrelatedIncident incident, List<IncidentActionResultResponse> recent) {
        List<IncidentRunbookStepResponse> steps = new ArrayList<>();
        String category = nvl(incident.getCategory());
        String recommended;
        String impact = incident.getSeverity() >= 4 ? "Impacto alto: priorizar diagnóstico e registrar evidências no GLPI." : "Impacto moderado: validar evidências antes de abrir/atualizar GLPI.";

        if ("WIFI_AP_INSTABILITY".equals(category) || "UNIFI_AP".equals(incident.getSourceType())) {
            recommended = "Validar AP, switch/porta, PoE/cabo, eventos UniFi e histórico GLPI antes de nova intervenção.";
            steps.add(step("CHECK_UNIFI", "Consultar UniFi", "Conferir eventos e estado operacional do AP afetado.", "READ_ONLY", "Resumo do que checar no painel UniFi/APs", true));
            steps.add(step("CHECK_SWITCH_PORT", "Verificar switch/porta", "Identificar porta/switch, PoE, cabo e última oscilação do AP.", "READ_ONLY", "Checklist de porta, PoE e cabo", true));
            steps.add(step("PING_HOST", "Ping host/AP", "Testar resolução e alcance ICMP do AP/host quando o nome resolver.", "READ_ONLY", "reachable/unreachable e tempo aproximado", true));
            steps.add(step("CHECK_GLPI", "Consultar GLPI", "Verificar se já existe chamado e próximos follow-ups necessários.", "READ_ONLY", "Chamado vinculado ou orientação de abertura", true));
            steps.add(step("CHECK_WIKI", "Ver Wiki relacionada", "Sugerir termos de busca para artigos existentes antes de documentar duplicado.", "READ_ONLY", "Consultas recomendadas", true));
            steps.add(step("CREATE_WIKI_DRAFT", "Criar rascunho Wiki", "Gerar rascunho de procedimento/causa conhecida, sem publicar automaticamente.", "READ_ONLY", "Markdown sugerido para revisão", true));
        } else if (category.contains("DISK")) {
            recommended = "Validar disco usado/total/livre, crescimento recente, diretórios maiores e política de limpeza antes de expandir.";
            steps.add(step("CHECK_ZABBIX", "Consultar Zabbix", "Conferir valor atual, host, item e severidade do alerta.", "READ_ONLY", "Resumo do alerta e métrica esperada", true));
            steps.add(step("PING_HOST", "Ping host", "Testar alcance básico do host antes de ações remotas.", "READ_ONLY", "reachable/unreachable", true));
            steps.add(step("CHECK_PORTS", "Ver portas", "Testar portas comuns seguras para acesso/serviço sem alterar o host.", "READ_ONLY", "Estado de 22/80/443/8080", true));
            steps.add(step("CHECK_WIKI", "Ver Wiki relacionada", "Buscar artigos de limpeza/expansão de disco para este host/sistema.", "READ_ONLY", "Consultas recomendadas", true));
            steps.add(step("GENERATE_CHECKLIST", "Gerar checklist", "Checklist operacional de diagnóstico sem executar limpeza.", "READ_ONLY", "Lista de comandos/verificações sugeridas", true));
            steps.add(step("DOCUMENT_SOLUTION", "Documentar solução", "Gerar estrutura de artigo Wiki após resolver o incidente.", "DOCUMENTATION", "Markdown pronto para revisar", true));
        } else if (category.contains("MEMORY")) {
            recommended = "Validar consumo de RAM, processos recentes, tendência e impacto antes de reiniciar serviços.";
            steps.add(step("CHECK_ZABBIX", "Consultar Zabbix", "Conferir métrica, janela e host do alerta de memória.", "READ_ONLY", "Resumo do alerta", true));
            steps.add(step("PING_HOST", "Ping host", "Confirmar alcance básico do host.", "READ_ONLY", "reachable/unreachable", true));
            steps.add(step("CHECK_WIKI", "Ver Wiki relacionada", "Buscar procedimento conhecido para pressão de memória.", "READ_ONLY", "Consultas recomendadas", true));
            steps.add(step("GENERATE_CHECKLIST", "Gerar checklist", "Checklist de investigação de RAM/processos.", "READ_ONLY", "Lista de verificações sugeridas", true));
            steps.add(step("CHECK_GLPI", "Consultar GLPI", "Ver chamado atual/duplicidade.", "READ_ONLY", "Estado GLPI", true));
        } else {
            recommended = "Validar monitoramento, conectividade, GLPI e Wiki antes de executar correções.";
            steps.add(step("CHECK_ZABBIX", "Consultar Zabbix", "Conferir origem, item/trigger e severidade do alerta.", "READ_ONLY", "Resumo do alerta", true));
            steps.add(step("PING_HOST", "Ping host", "Testar alcance básico do host afetado.", "READ_ONLY", "reachable/unreachable", true));
            steps.add(step("CHECK_PORTS", "Ver portas", "Testar portas comuns sem alterar serviço.", "READ_ONLY", "Estado de portas", true));
            steps.add(step("CHECK_GLPI", "Consultar GLPI", "Ver ticket vinculado ou necessidade de abertura.", "READ_ONLY", "Estado GLPI", true));
            steps.add(step("CHECK_WIKI", "Ver Wiki relacionada", "Sugerir termos de busca em procedimentos existentes.", "READ_ONLY", "Consultas recomendadas", true));
            steps.add(step("GENERATE_CHECKLIST", "Gerar checklist", "Checklist geral de triagem.", "READ_ONLY", "Lista de verificações", true));
            steps.add(step("CREATE_WIKI_DRAFT", "Criar rascunho Wiki", "Gerar documentação inicial para revisão.", "READ_ONLY", "Markdown sugerido", true));
        }
        return new IncidentRunbookResponse(incident.getId(), category, recommended, impact, steps, recent);
    }

    @Transactional
    public IncidentActionResultResponse execute(UUID incidentId, String actionKey, Authentication auth) {
        CorrelatedIncident incident = incidentRepository.findById(incidentId).orElseThrow();
        long start = System.currentTimeMillis();
        String key = normAction(actionKey);
        ActionOutput out = switch (key) {
            case "PING_HOST" -> ping(incident);
            case "CHECK_PORTS" -> ports(incident);
            case "CHECK_ZABBIX" -> zabbix(incident);
            case "CHECK_UNIFI" -> unifi(incident);
            case "CHECK_SWITCH_PORT" -> switchPort(incident);
            case "CHECK_GLPI" -> glpi(incident);
            case "CHECK_WIKI" -> wiki(incident);
            case "GENERATE_CHECKLIST" -> checklist(incident);
            case "CREATE_WIKI_DRAFT", "DOCUMENT_SOLUTION" -> wikiDraft(incident);
            default -> new ActionOutput("UNKNOWN_ACTION", "Ação desconhecida", "A ação solicitada não existe neste runbook.", "Use uma das ações listadas no runbook.");
        };
        IncidentActionResult saved = resultRepository.save(IncidentActionResult.builder()
                .incident(incident)
                .actionKey(key)
                .status(out.status())
                .title(out.title())
                .summary(out.summary())
                .output(out.output())
                .executedBy(username(auth))
                .executedAt(LocalDateTime.now())
                .durationMs(System.currentTimeMillis() - start)
                .build());
        return IncidentActionResultResponse.from(saved);
    }

    public List<IncidentActionResultResponse> recent(UUID incidentId) {
        if (resultRepository == null) return List.of();
        return resultRepository.findTop20ByIncidentIdOrderByExecutedAtDesc(incidentId).stream().map(IncidentActionResultResponse::from).toList();
    }

    private ActionOutput ping(CorrelatedIncident i) {
        String host = safeHost(i.getAffectedHost());
        if (host.isBlank()) return warn("Ping host", "Sem host válido", "Incidente não possui host/AP seguro para teste ICMP.");
        try {
            long start = System.currentTimeMillis();
            boolean ok = InetAddress.getByName(host).isReachable(1800);
            long ms = System.currentTimeMillis() - start;
            return new ActionOutput(ok ? "SUCCESS" : "WARNING", "Ping host", ok ? "Host respondeu ao ICMP/resolução." : "Host não respondeu ao ICMP dentro do timeout.", "Host: " + host + "\nResultado: " + (ok ? "reachable" : "unreachable") + "\nTempo: " + ms + "ms\nObservação: ICMP pode ser bloqueado por firewall; confirmar com Zabbix/serviço.");
        } catch (Exception e) { return warn("Ping host", "Falha ao testar host", e.getMessage()); }
    }

    private ActionOutput ports(CorrelatedIncident i) {
        String host = safeHost(i.getAffectedHost());
        if (host.isBlank()) return warn("Ver portas", "Sem host válido", "Incidente não possui host seguro para teste TCP.");
        int[] ports = {22, 80, 443, 8080, 8443};
        StringBuilder sb = new StringBuilder("Host: ").append(host).append("\n");
        int open = 0;
        for (int port : ports) {
            boolean ok = false;
            try (Socket socket = new Socket()) { socket.connect(new InetSocketAddress(host, port), 900); ok = true; open++; }
            catch (Exception ignored) { }
            sb.append("- ").append(port).append(": ").append(ok ? "aberta" : "fechada/timeout").append("\n");
        }
        return new ActionOutput(open > 0 ? "SUCCESS" : "WARNING", "Ver portas", open + " porta(s) comum(ns) responderam.", sb.toString());
    }

    private ActionOutput zabbix(CorrelatedIncident i) {
        return ok("Consultar Zabbix", "Use o painel Zabbix/NexusIT para confirmar valor atual do alerta.",
                "Incidente: " + i.getTitle() + "\nHost: " + nvl(i.getAffectedHost()) + "\nCategoria: " + nvl(i.getCategory()) + "\nSeveridade: S" + i.getSeverity() + "\nÚltima evidência: " + nvl(i.getSummary()) + "\nPróximo passo: confirmar item/trigger, valor atual, janela e se o problema ainda aparece em Monitoring > Problems.");
    }

    private ActionOutput unifi(CorrelatedIncident i) {
        return ok("Consultar UniFi", "Verificar eventos UniFi do AP e painel /monitoring/aps.",
                "AP/Host: " + nvl(i.getAffectedHost()) + "\nVerificar: uptime, reboots 24h, perda ICMP, AP→switch→porta, eventos de desconexão e clientes afetados.\nSe o evento for apenas login/client-connect normal, não tratar como falha.");
    }

    private ActionOutput switchPort(CorrelatedIncident i) {
        return ok("Verificar switch/porta", "Checklist de PoE/cabo/porta para AP instável.",
                "AP: " + nvl(i.getAffectedHost()) + "\n1. Conferir AP→switch→porta no painel UniFi.\n2. Validar PoE ligado e potência disponível.\n3. Conferir cabo/conector e histórico de link down/up.\n4. Se a porta for conhecida como notebook/desligamento esperado, suprimir ruído antes de abrir GLPI.\n5. Se recorrente, anexar evidências ao GLPI.");
    }

    private ActionOutput glpi(CorrelatedIncident i) {
        if (i.getOpenGlpiTicketId() != null && i.getOpenGlpiTicketId() > 0) {
            return ok("Consultar GLPI", "Incidente já possui GLPI vinculado.", "Chamado vinculado: #" + i.getOpenGlpiTicketId() + "\nPróximo passo: adicionar follow-up técnico com evidências antes de fechar/documentar.");
        }
        return warn("Consultar GLPI", "Sem GLPI vinculado", "Não há chamado vinculado. Se impacto confirmado ou recorrente, usar `Criar GLPI` para criar/reusar chamado com marcador anti-duplicidade.");
    }

    private ActionOutput wiki(CorrelatedIncident i) {
        String q1 = compact(i.getAffectedHost() + " " + i.getCategory());
        String q2 = compact(i.getTitle());
        String q3 = compact(i.getSourceType() + " " + i.getCategory());
        return ok("Ver Wiki relacionada", "Consultas sugeridas para evitar documentação duplicada.",
                "Buscar na Wiki por:\n- " + q1 + "\n- " + q2 + "\n- " + q3 + "\nSe houver artigo existente, vincular/usar antes de criar novo procedimento.");
    }

    private ActionOutput checklist(CorrelatedIncident i) {
        StringBuilder sb = new StringBuilder();
        sb.append("Checklist seguro para ").append(i.getTitle()).append("\n\n");
        sb.append("1. Confirmar se o alerta ainda está ativo no Zabbix/UniFi.\n");
        sb.append("2. Confirmar impacto com usuário/sistema afetado.\n");
        sb.append("3. Validar host/AP, severidade, horário e recorrência.\n");
        sb.append("4. Consultar Wiki por procedimento existente.\n");
        sb.append("5. Se houver GLPI, adicionar follow-up técnico com evidências.\n");
        sb.append("6. Se resolver, documentar causa raiz e validação.\n");
        if (nvl(i.getCategory()).contains("DISK")) sb.append("7. Para disco: levantar usado/total/livre e maiores diretórios antes de limpar.\n");
        if (nvl(i.getCategory()).contains("MEMORY")) sb.append("7. Para memória: levantar processos e tendência antes de reiniciar.\n");
        return ok("Gerar checklist", "Checklist gerado para execução manual segura.", sb.toString());
    }

    private ActionOutput wikiDraft(CorrelatedIncident i) {
        String title = "NexusIT — " + i.getAffectedHost() + " — " + i.getCategory();
        String md = "# " + title + "\n\n" +
                "## Sintoma\n" + nvl(i.getSummary()) + "\n\n" +
                "## Ambiente afetado\n- Origem: " + nvl(i.getSourceType()) + "\n- Host/AP: " + nvl(i.getAffectedHost()) + "\n- Severidade: S" + i.getSeverity() + "\n- Incidente: " + i.getId() + "\n\n" +
                "## Diagnóstico\n- Confirmar valor atual no monitoramento.\n- Registrar evidências coletadas.\n\n" +
                "## Correção aplicada\n- Descrever ação executada após validação.\n\n" +
                "## Validação\n- Confirmar recovery no Zabbix/UniFi.\n- Confirmar normalização para usuários/sistema.\n\n" +
                "## Observações\n" + nvl(i.getRecommendation()) + "\n";
        return ok("Criar rascunho Wiki", "Rascunho Markdown gerado; revisar antes de publicar.", md);
    }

    private static IncidentRunbookStepResponse step(String key, String title, String desc, String safety, String expected, boolean executable) {
        return new IncidentRunbookStepResponse(key, title, desc, safety, expected, executable);
    }
    private static ActionOutput ok(String title, String summary, String output) { return new ActionOutput("SUCCESS", title, summary, output); }
    private static ActionOutput warn(String title, String summary, String output) { return new ActionOutput("WARNING", title, summary, output); }
    private record ActionOutput(String status, String title, String summary, String output) {}
    private static String normAction(String s) { return s == null ? "" : s.trim().toUpperCase(Locale.ROOT).replaceAll("[^A-Z0-9_]+", "_"); }
    private static String username(Authentication auth) { return auth == null || auth.getName() == null ? "nexusit" : auth.getName(); }
    private static String nvl(String s) { return s == null || s.isBlank() ? "—" : s; }
    private static String compact(String s) { return nvl(s).replaceAll("\\s+", " ").trim(); }
    private static String safeHost(String host) {
        if (host == null) return "";
        String h = host.trim();
        if (h.length() > 120) return "";
        return h.matches("[A-Za-z0-9._-]+") ? h : "";
    }
}
