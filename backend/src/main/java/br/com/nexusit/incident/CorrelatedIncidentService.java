package br.com.nexusit.incident;

import br.com.nexusit.glpi.GlpiClient;
import br.com.nexusit.monitoring.UnifiApInstabilityItem;
import br.com.nexusit.monitoring.ZabbixProblem;
import lombok.RequiredArgsConstructor;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.text.Normalizer;
import java.time.Instant;
import java.time.LocalDateTime;
import java.time.ZoneId;
import java.util.*;

@Service
@RequiredArgsConstructor
@Transactional(readOnly = true)
public class CorrelatedIncidentService {
    private final CorrelatedIncidentRepository incidentRepository;
    private final CorrelatedIncidentEventRepository eventRepository;
    private final GlpiClient glpiClient;

    @Value("${application.glpi.category-id:${GLPI_CATEGORY_ID:1}}")
    private int glpiCategoryId;

    @Value("${application.glpi.assign-user-id:${GLPI_ASSIGN_USER_ID:2}}")
    private int glpiAssignUserId;

    public IncidentListResponse listOpen() {
        List<CorrelatedIncidentResponse> incidents = incidentRepository.findTop50ByStatusOrderByLastSeenAtDesc("OPEN")
                .stream().map(CorrelatedIncidentResponse::from).toList();
        int withTicket = (int) incidents.stream().filter(i -> i.openGlpiTicketId() != null && i.openGlpiTicketId() > 0).count();
        return new IncidentListResponse(incidents.size(), withTicket, incidents.size() - withTicket, incidents);
    }

    public IncidentDetailResponse detail(UUID id) {
        CorrelatedIncident incident = incidentRepository.findById(id).orElseThrow();
        List<CorrelatedIncidentEventResponse> events = eventRepository.findTop20ByIncidentIdOrderByObservedAtDesc(id)
                .stream().map(CorrelatedIncidentEventResponse::from).toList();
        return new IncidentDetailResponse(CorrelatedIncidentResponse.from(incident), events, analyze(incident, events));
    }

    @Transactional
    public CorrelatedIncident touchZabbix(ZabbixProblem p) {
        String key = zabbixKey(p.hostName(), p.name());
        LocalDateTime observed = LocalDateTime.ofInstant(Instant.ofEpochSecond(p.clock()), ZoneId.systemDefault());
        CorrelatedIncident incident = incidentRepository.findByCorrelationKey(key).orElseGet(() -> CorrelatedIncident.builder()
                .correlationKey(key)
                .sourceType("ZABBIX")
                .category(classifyZabbix(p.name()))
                .title("[Zabbix] " + p.hostName() + ": " + p.name())
                .affectedHost(p.hostName())
                .severity(p.severity())
                .status("OPEN")
                .firstSeenAt(observed)
                .lastSeenAt(observed)
                .occurrenceCount(0)
                .summary("Alerta Zabbix correlacionado: " + p.name())
                .recommendation(recommendZabbix(p))
                .build());
        boolean newOccurrence = incident.getLastSourceEventId() == null || !incident.getLastSourceEventId().equals(p.id());
        incident.setLastSeenAt(LocalDateTime.now());
        incident.setSeverity(Math.max(incident.getSeverity(), p.severity()));
        incident.setLastSourceEventId(p.id());
        incident.setSummary("Host " + p.hostName() + " com alerta: " + p.name());
        incident.setRecommendation(recommendZabbix(p));
        if (newOccurrence) incident.setOccurrenceCount(Math.max(0, incident.getOccurrenceCount()) + 1);
        incident = incidentRepository.save(incident);
        if (newOccurrence) addEvent(incident, "ZABBIX", p.id(), "ALERT_OPEN", p.severity(), p.name(), Map.of(
                "host", p.hostName(), "alert", p.name(), "severityLabel", p.severityLabel(), "clock", p.clock()));
        return incident;
    }

    @Transactional
    public CorrelatedIncident touchUnifiAp(UnifiApInstabilityItem item) {
        String key = unifiApKey(item.apName());
        CorrelatedIncident incident = incidentRepository.findByCorrelationKey(key).orElseGet(() -> CorrelatedIncident.builder()
                .correlationKey(key)
                .sourceType("UNIFI_AP")
                .category("WIFI_AP_INSTABILITY")
                .title("[UniFi] AP " + item.apName() + " instável")
                .affectedHost(item.apName())
                .severity(item.ticketRecommended() ? 4 : 3)
                .status("OPEN")
                .firstSeenAt(LocalDateTime.now())
                .lastSeenAt(LocalDateTime.now())
                .occurrenceCount(0)
                .summary(item.reason())
                .recommendation(item.recommendation())
                .build());
        String sourceEventId = "score:" + item.score() + ":loss:" + item.lossSamples24h() + ":down:" + item.downSamples24h() + ":reboots:" + item.reboots24h();
        boolean newOccurrence = incident.getLastSourceEventId() == null || !incident.getLastSourceEventId().equals(sourceEventId);
        incident.setLastSeenAt(LocalDateTime.now());
        incident.setSeverity(Math.max(incident.getSeverity(), item.ticketRecommended() ? 4 : 3));
        incident.setLastSourceEventId(sourceEventId);
        incident.setSummary(item.reason());
        incident.setRecommendation(item.recommendation());
        if (newOccurrence) incident.setOccurrenceCount(Math.max(0, incident.getOccurrenceCount()) + 1);
        incident = incidentRepository.save(incident);
        if (newOccurrence) addEvent(incident, "UNIFI_AP", sourceEventId, "INSTABILITY", incident.getSeverity(), item.reason(), Map.of(
                "apName", item.apName(), "score", item.score(), "lossSamples24h", item.lossSamples24h(),
                "downWindows24h", item.downWindows24h(), "reboots24h", item.reboots24h(), "switchName", nvl(item.switchName()), "switchPort", nvl(item.switchPort())));
        return incident;
    }

    @Transactional
    public Map<String, Object> createOrReuseTicket(UUID incidentId, String extraReason) {
        CorrelatedIncident incident = incidentRepository.findById(incidentId).orElseThrow();
        if (incident.getOpenGlpiTicketId() != null && incident.getOpenGlpiTicketId() > 0) {
            addFollowup(incident.getOpenGlpiTicketId(), "Nova evidência correlacionada pelo NexusIT.\n\n" + incident.getSummary());
            return Map.of("ticketId", incident.getOpenGlpiTicketId(), "created", false, "incidentId", incident.getId());
        }
        Optional<Integer> existing = findOpenTicket(incident);
        if (existing.isPresent()) {
            incident.setOpenGlpiTicketId(existing.get());
            incidentRepository.save(incident);
            addFollowup(existing.get(), "Incidente correlacionado pelo NexusIT.\n\n" + incident.getSummary());
            return Map.of("ticketId", existing.get(), "created", false, "incidentId", incident.getId());
        }
        int ticketId = createTicket(incident, extraReason);
        incident.setOpenGlpiTicketId(ticketId);
        incidentRepository.save(incident);
        addEvent(incident, "GLPI", String.valueOf(ticketId), "TICKET_LINKED", incident.getSeverity(), "GLPI #" + ticketId + " vinculado ao incidente", Map.of("ticketId", ticketId));
        return Map.of("ticketId", ticketId, "created", true, "incidentId", incident.getId());
    }

    public String analyzeIncident(UUID id) {
        return detail(id).analysis();
    }

    private int createTicket(CorrelatedIncident incident, String extraReason) {
        String marker = marker(incident.getCorrelationKey());
        String title = incident.getTitle();
        if (title.length() > 250) title = title.substring(0, 250);
        String content = "Chamado criado pelo módulo de Incidentes Correlacionados do NexusIT.\n\n" +
                "Incidente: " + incident.getTitle() + "\n" +
                "Origem: " + incident.getSourceType() + "\n" +
                "Categoria: " + incident.getCategory() + "\n" +
                "Host/AP afetado: " + nvl(incident.getAffectedHost()) + "\n" +
                "Severidade: " + incident.getSeverity() + "\n" +
                "Ocorrências correlacionadas: " + incident.getOccurrenceCount() + "\n" +
                "Primeiro visto: " + incident.getFirstSeenAt() + "\n" +
                "Último visto: " + incident.getLastSeenAt() + "\n\n" +
                "Resumo: " + nvl(incident.getSummary()) + "\n\n" +
                "Recomendação: " + nvl(incident.getRecommendation()) + "\n\n" +
                (extraReason == null || extraReason.isBlank() ? "" : "Observação: " + extraReason.trim() + "\n\n") +
                marker;
        int priority = incident.getSeverity() >= 5 ? 5 : incident.getSeverity() >= 4 ? 4 : 3;
        Map<String, Object> input = new LinkedHashMap<>();
        input.put("name", title);
        input.put("content", content);
        input.put("entities_id", 0);
        input.put("itilcategories_id", glpiCategoryId);
        input.put("priority", priority);
        input.put("urgency", priority);
        input.put("impact", priority);
        input.put("type", 1);
        input.put("status", 2);
        input.put("_users_id_assign", glpiAssignUserId);
        Map<String, Object> data = glpiClient.post("/Ticket", Map.of("input", input));
        Object id = data != null ? data.get("id") : null;
        if (id == null && data != null && data.get("input") instanceof Map<?, ?> m) id = m.get("id");
        if (id == null) throw new IllegalStateException("GLPI não retornou ID do chamado");
        return Integer.parseInt(String.valueOf(id));
    }

    private Optional<Integer> findOpenTicket(CorrelatedIncident incident) {
        String marker = marker(incident.getCorrelationKey());
        try {
            List<Map<String, Object>> rows = glpiClient.getList("/Ticket", Map.of(
                    "range", "0-199", "expand_dropdowns", "true", "get_hateoas", "false", "is_deleted", "0", "order", "DESC", "sort", "date_mod"));
            if (rows == null) return Optional.empty();
            String host = norm(incident.getAffectedHost());
            for (Map<String, Object> row : rows) {
                int status = intVal(row.get("status"));
                if (status >= 5) continue;
                String name = String.valueOf(row.getOrDefault("name", ""));
                String content = String.valueOf(row.getOrDefault("content", ""));
                if (content.contains(marker)) return Optional.of(intVal(row.get("id")));
                if (!host.isBlank() && norm(name).contains(host) && (name.contains("[Zabbix]") || name.contains("[UniFi]"))) {
                    return Optional.of(intVal(row.get("id")));
                }
            }
        } catch (Exception ignored) { }
        return Optional.empty();
    }

    private void addFollowup(int ticketId, String content) {
        try { glpiClient.post("/Ticket/" + ticketId + "/ITILFollowup", Map.of("input", Map.of("items_id", ticketId, "content", content))); }
        catch (Exception ignored) { }
    }

    @Transactional
    public void addEvent(CorrelatedIncident incident, String sourceType, String sourceEventId, String eventType, int severity, String message, Map<String, Object> payload) {
        eventRepository.save(CorrelatedIncidentEvent.builder()
                .incident(incident).sourceType(sourceType).sourceEventId(sourceEventId).eventType(eventType)
                .severity(severity).message(message).payload(payload).observedAt(LocalDateTime.now()).build());
    }

    private String analyze(CorrelatedIncident i, List<CorrelatedIncidentEventResponse> events) {
        StringBuilder sb = new StringBuilder();
        sb.append("Análise operacional NexusIT\n\n");
        sb.append("Incidente: ").append(i.getTitle()).append("\n");
        sb.append("Ocorrências correlacionadas: ").append(i.getOccurrenceCount()).append("\n");
        sb.append("GLPI relacionado: ").append(i.getOpenGlpiTicketId() == null ? "nenhum" : "#" + i.getOpenGlpiTicketId()).append("\n\n");
        sb.append("Causa provável: ");
        if ("WIFI_AP_INSTABILITY".equals(i.getCategory())) sb.append("instabilidade de Wi‑Fi/PoE/cabo/porta do switch ou reinício do AP.\n");
        else if (i.getCategory().contains("DISK")) sb.append("crescimento de uso em disco exigindo limpeza ou expansão.\n");
        else if (i.getCategory().contains("MEMORY")) sb.append("pressão de memória ou processo consumindo RAM.\n");
        else sb.append("alerta recorrente do monitoramento que exige checagem técnica.\n");
        sb.append("Impacto: ").append(i.getSeverity() >= 4 ? "alto, recomendado tratar com prioridade." : "moderado, acompanhar e agir se persistir.").append("\n");
        sb.append("Próximas ações: ").append(nvl(i.getRecommendation())).append("\n");
        if (!events.isEmpty()) sb.append("Última evidência: ").append(events.get(0).message()).append("\n");
        return sb.toString();
    }

    public static String zabbixKey(String host, String alert) { return "zabbix:" + norm(host) + ":" + norm(alert); }
    public static String unifiApKey(String apName) { return "unifi-ap:" + norm(apName); }
    public static String marker(String key) { return "NEXUSIT_INCIDENT:" + key; }
    private static String classifyZabbix(String name) {
        String n = norm(name);
        if (n.contains("disco") || n.contains("space") || n.contains("filesystem")) return "ZABBIX_DISK";
        if (n.contains("memoria") || n.contains("memory")) return "ZABBIX_MEMORY";
        if (n.contains("icmp") || n.contains("ping") || n.contains("unavailable") || n.contains("offline")) return "ZABBIX_AVAILABILITY";
        if (n.contains("servico") || n.contains("service")) return "ZABBIX_SERVICE";
        if (n.contains("vpn") || n.contains("tunnel")) return "ZABBIX_VPN";
        return "ZABBIX_ALERT";
    }
    private static String recommendZabbix(ZabbixProblem p) {
        String n = norm(p.name());
        if (n.contains("disco")) return "Validar uso/total/livre do disco, limpar arquivos temporários e avaliar expansão se recorrente.";
        if (n.contains("memoria")) return "Validar processos consumidores, tendência de RAM e necessidade de reinício/ajuste de serviço.";
        if (n.contains("servico")) return "Confirmar se o serviço é crítico; se for, reiniciar e investigar motivo da parada.";
        if (n.contains("vpn")) return "Confirmar se o túnel ainda é usado; se crítico, validar conectividade, credenciais e rota.";
        return "Validar no host afetado, confirmar impacto ao usuário e aplicar procedimento da Wiki se existir.";
    }
    private static String nvl(String s) { return s == null || s.isBlank() ? "—" : s; }
    private static int intVal(Object value) { try { return Integer.parseInt(String.valueOf(value)); } catch (Exception e) { return 0; } }
    private static String norm(String s) {
        if (s == null) return "";
        return Normalizer.normalize(s, Normalizer.Form.NFD).replaceAll("\\p{M}", "").toLowerCase(Locale.ROOT).replaceAll("[^a-z0-9]+", "-").replaceAll("(^-|-$)", "");
    }
}
