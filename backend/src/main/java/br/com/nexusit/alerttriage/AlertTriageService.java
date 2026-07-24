package br.com.nexusit.alerttriage;

import br.com.nexusit.glpi.GlpiClient;
import br.com.nexusit.monitoring.ZabbixProblem;
import br.com.nexusit.monitoring.ZabbixService;
import br.com.nexusit.user.User;
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
public class AlertTriageService {
    private final AlertTriageRuleRepository repository;
    private final ZabbixService zabbixService;
    private final GlpiClient glpiClient;

    @Value("${application.glpi.category-id:${GLPI_CATEGORY_ID:1}}")
    private int glpiCategoryId;

    @Value("${application.glpi.assign-user-id:${GLPI_ASSIGN_USER_ID:2}}")
    private int glpiAssignUserId;

    public AlertTriageSummary getSummary(boolean includeSuppressed) {
        List<AlertTriageRule> rules = repository.findByEnabledTrueOrderByUpdatedAtDesc();
        List<AlertTriageRuleResponse> allRules = repository.findAllByOrderByUpdatedAtDesc().stream()
                .map(AlertTriageRuleResponse::from).toList();
        long now = Instant.now().getEpochSecond();
        List<AlertTriageItem> items = new ArrayList<>();
        for (ZabbixProblem p : zabbixService.getProblems()) {
            AlertTriageRule rule = findBestRule(p, rules).orElse(null);
            AlertTriageAction action = rule != null ? rule.getAction() : defaultAction(p);
            boolean expiredSilence = action == AlertTriageAction.SILENCE_TEMPORARILY
                    && rule != null && rule.getSilencedUntil() != null && rule.getSilencedUntil().isBefore(LocalDateTime.now());
            if (expiredSilence) action = AlertTriageAction.SHOW_ONLY;
            boolean suppressed = action == AlertTriageAction.IGNORE || action == AlertTriageAction.SILENCE_TEMPORARILY;
            if (suppressed && !includeSuppressed) continue;
            long age = Math.max(0, now - p.clock());
            boolean ticketEligible = action == AlertTriageAction.CREATE_TICKET_IMMEDIATELY || p.severity() >= 4;
            String status = switch (action) {
                case IGNORE -> "DESCARTADO";
                case SILENCE_TEMPORARILY -> "SILENCIADO";
                case CREATE_TICKET_IMMEDIATELY -> "ACIONAVEL";
                case CREATE_TICKET_AFTER_DELAY, CREATE_TICKET_ON_RECURRENCE -> "AGUARDANDO_REGRA";
                case SHOW_ONLY -> "TRIAGEM";
            };
            items.add(new AlertTriageItem(
                    p.id(), p.hostName(), p.name(), p.severity(), p.severityLabel(), p.clock(), age,
                    status, action, AlertTriageRuleResponse.label(action), rule != null ? rule.getId() : null,
                    rule != null ? rule.getReason() : null, rule != null ? rule.getSilencedUntil() : null,
                    ticketEligible,
                    recommendation(p, action, age)));
        }
        int ignored = (int) items.stream().filter(i -> i.action() == AlertTriageAction.IGNORE).count();
        int silenced = (int) items.stream().filter(i -> i.action() == AlertTriageAction.SILENCE_TEMPORARILY).count();
        int actionable = (int) items.stream().filter(AlertTriageItem::ticketEligible).count();
        int showOnly = (int) items.stream().filter(i -> i.action() == AlertTriageAction.SHOW_ONLY).count();
        int high = (int) items.stream().filter(i -> i.severity() >= 4).count();
        return new AlertTriageSummary(items.size(), actionable, showOnly, ignored, silenced, high, items, allRules);
    }

    @Transactional
    public AlertTriageRuleResponse createRule(AlertTriageRuleRequest req, User user) {
        AlertTriageRule rule = AlertTriageRule.builder()
                .hostPattern(blankToNull(req.hostPattern()))
                .alertPattern(blankToNull(req.alertPattern()))
                .severityMin(req.severityMin())
                .severityMax(req.severityMax())
                .action(req.action() != null ? req.action() : AlertTriageAction.SHOW_ONLY)
                .reason(blankToNull(req.reason()))
                .silencedUntil(req.silencedUntil())
                .enabled(req.enabled() == null || req.enabled())
                .createdBy(user)
                .build();
        return AlertTriageRuleResponse.from(repository.save(rule));
    }

    @Transactional
    public AlertTriageRuleResponse decide(AlertTriageDecisionRequest req, User user) {
        ZabbixProblem p = findProblem(req.eventId());
        AlertTriageAction action = req.action() != null ? req.action() : AlertTriageAction.SHOW_ONLY;
        LocalDateTime until = action == AlertTriageAction.SILENCE_TEMPORARILY
                ? (req.silencedUntil() != null ? req.silencedUntil() : LocalDateTime.now().plusHours(24)) : null;
        AlertTriageRule rule = AlertTriageRule.builder()
                .hostPattern(p.hostName())
                .alertPattern(p.name())
                .severityMin(p.severity())
                .severityMax(p.severity())
                .action(action)
                .reason(blankToNull(req.reason()))
                .silencedUntil(until)
                .enabled(true)
                .createdBy(user)
                .build();
        return AlertTriageRuleResponse.from(repository.save(rule));
    }

    @Transactional
    public AlertTriageRuleResponse updateRule(UUID id, AlertTriageRuleRequest req) {
        AlertTriageRule rule = repository.findById(id).orElseThrow();
        rule.setHostPattern(blankToNull(req.hostPattern()));
        rule.setAlertPattern(blankToNull(req.alertPattern()));
        rule.setSeverityMin(req.severityMin());
        rule.setSeverityMax(req.severityMax());
        if (req.action() != null) rule.setAction(req.action());
        rule.setReason(blankToNull(req.reason()));
        rule.setSilencedUntil(req.silencedUntil());
        rule.setEnabled(req.enabled() == null || req.enabled());
        return AlertTriageRuleResponse.from(repository.save(rule));
    }

    @Transactional
    public AlertTriageRuleResponse enableRule(UUID id, boolean enabled) {
        AlertTriageRule rule = repository.findById(id).orElseThrow();
        rule.setEnabled(enabled);
        return AlertTriageRuleResponse.from(repository.save(rule));
    }

    @Transactional
    public Map<String, Object> createTicket(String eventId) {
        ZabbixProblem p = findProblem(eventId);
        int ticketId = createGlpiTicket(p);
        return Map.of("ticketId", ticketId, "eventId", p.id(), "hostName", p.hostName(), "alertName", p.name());
    }

    public Optional<AlertTriageRule> findBestRule(ZabbixProblem p, List<AlertTriageRule> rules) {
        return rules.stream()
                .filter(r -> matches(r, p))
                .findFirst();
    }

    private boolean matches(AlertTriageRule r, ZabbixProblem p) {
        if (!r.isEnabled()) return false;
        if (r.getSeverityMin() != null && p.severity() < r.getSeverityMin()) return false;
        if (r.getSeverityMax() != null && p.severity() > r.getSeverityMax()) return false;
        if (r.getHostPattern() != null && !containsNorm(p.hostName(), r.getHostPattern())) return false;
        if (r.getAlertPattern() != null && !containsNorm(p.name(), r.getAlertPattern())) return false;
        return true;
    }

    private AlertTriageAction defaultAction(ZabbixProblem p) {
        return p.severity() >= 4 ? AlertTriageAction.CREATE_TICKET_IMMEDIATELY : AlertTriageAction.SHOW_ONLY;
    }

    private String recommendation(ZabbixProblem p, AlertTriageAction action, long ageSeconds) {
        if (action == AlertTriageAction.IGNORE) return "Alerta descartado por regra. Não abre GLPI.";
        if (action == AlertTriageAction.SILENCE_TEMPORARILY) return "Alerta silenciado temporariamente. Pode ser reativado nas regras.";
        if (p.severity() >= 4) return "Severidade alta: recomendado criar chamado se ainda não existir.";
        if (ageSeconds < 600) return "Evento recente: manter em observação antes de abrir GLPI.";
        return "Avaliar recorrência/duração e criar chamado se exigir ação humana.";
    }

    private ZabbixProblem findProblem(String eventId) {
        return zabbixService.getProblems().stream()
                .filter(p -> Objects.equals(p.id(), eventId))
                .findFirst()
                .orElseThrow(() -> new NoSuchElementException("Alerta Zabbix não encontrado ou já recuperado"));
    }

    private int createGlpiTicket(ZabbixProblem p) {
        int priority = p.severity() >= 5 ? 5 : p.severity() == 4 ? 4 : 3;
        String title = ("[Zabbix] " + p.hostName() + ": " + p.name());
        if (title.length() > 250) title = title.substring(0, 250);
        String detected = LocalDateTime.ofInstant(Instant.ofEpochSecond(p.clock()), ZoneId.systemDefault()).toString();
        String content = "Chamado criado manualmente pela Central de Triagem de Alertas do NexusIT.\n\n" +
                "Host: " + p.hostName() + "\n" +
                "Alerta: " + p.name() + "\n" +
                "Severidade: " + p.severityLabel() + "\n" +
                "Event ID Zabbix: " + p.id() + "\n" +
                "Detectado em: " + detected + "\n\n" +
                "ZABBIX_EVENT_ID: " + p.id();
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
        Map<String, Object> payload = Map.of("input", input);
        Map<String, Object> data = glpiClient.post("/Ticket", payload);
        Object id = data != null ? (data.get("id") != null ? data.get("id") : data.get("input") instanceof Map<?,?> m ? m.get("id") : null) : null;
        if (id == null) throw new IllegalStateException("GLPI não retornou ID do chamado");
        try { return Integer.parseInt(String.valueOf(id)); } catch (Exception e) { throw new IllegalStateException("ID GLPI inválido: " + id); }
    }

    private static String blankToNull(String s) { return s == null || s.isBlank() ? null : s.trim(); }
    private static boolean containsNorm(String source, String needle) {
        if (needle == null || needle.isBlank()) return true;
        return norm(source).contains(norm(needle));
    }
    private static String norm(String s) {
        if (s == null) return "";
        return Normalizer.normalize(s, Normalizer.Form.NFD).replaceAll("\\p{M}", "").toLowerCase(Locale.ROOT);
    }
}
