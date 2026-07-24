package br.com.nexusit.monitoring;

import br.com.nexusit.glpi.GlpiClient;
import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import lombok.RequiredArgsConstructor;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.nio.file.Files;
import java.nio.file.Path;
import java.time.LocalDateTime;
import java.util.*;
import java.util.stream.Collectors;

@Service
@RequiredArgsConstructor
@Transactional(readOnly = true)
public class UnifiApInstabilityService {
    private static final Path UNIFI_AP_SNAPSHOT = Path.of(
            System.getenv().getOrDefault("UNIFI_AP_SNAPSHOT_PATH", "/home/galdino/.hermes/state/unifi_ap_monitor_snapshot.json"));

    private final UnifiApMetricSampleRepository repository;
    private final ObjectMapper objectMapper;
    private final GlpiClient glpiClient;

    @Value("${application.glpi.category-id:${GLPI_CATEGORY_ID:1}}")
    private int glpiCategoryId;

    @Value("${application.glpi.assign-user-id:${GLPI_ASSIGN_USER_ID:2}}")
    private int glpiAssignUserId;

    public UnifiApInstabilitySummary getInstability() {
        Map<String, JsonNode> snapshotAps = readSnapshotAps();
        LocalDateTime now = LocalDateTime.now();
        Map<String, List<UnifiApMetricSample>> byAp = repository
                .findByRecordedAtAfterOrderByApNameAscRecordedAtAsc(now.minusHours(24))
                .stream().collect(Collectors.groupingBy(UnifiApMetricSample::getApName, LinkedHashMap::new, Collectors.toList()));

        Set<String> names = new TreeSet<>(String.CASE_INSENSITIVE_ORDER);
        names.addAll(snapshotAps.keySet());
        names.addAll(byAp.keySet());

        List<UnifiApInstabilityItem> items = new ArrayList<>();
        for (String apName : names) {
            JsonNode ap = snapshotAps.get(apName);
            List<UnifiApMetricSample> samples = byAp.getOrDefault(apName, List.of());
            WindowStats w1 = stats(samples, now.minusHours(1));
            WindowStats w6 = stats(samples, now.minusHours(6));
            WindowStats w24 = stats(samples, now.minusHours(24));

            int snapshotDown24 = intField(ap, "downSamples24h", 0);
            int snapshotLoss24 = intField(ap, "lossSamples24h", 0);
            int down24 = Math.max(w24.downSamples, snapshotDown24);
            int loss24 = Math.max(w24.lossSamples, snapshotLoss24);
            int reboots = intField(ap, "reboots24h", 0);
            int audit = intField(ap, "auditEvents24h", 0);
            int offlineMin = Math.max(w24.downSamples * 5, snapshotDown24); // snapshot é minutely; histórico NexusIT é 5 min.

            int score = down24 * 8 + w24.downWindows * 18 + Math.max(0, loss24 - 2) * 2 + reboots * 12 + Math.max(0, audit - 1) * 4;
            boolean recommended = w24.downWindows >= 3 || down24 >= 5 || loss24 >= 10 || reboots >= 2;
            boolean visible = recommended || down24 > 0 || loss24 >= 3 || reboots >= 2 || audit >= 3 || w24.downWindows > 0;
            if (!visible) continue;

            String tone = recommended ? "down" : "warning";
            String status = recommended ? "RECOMENDADO_ABRIR_CHAMADO" : "OBSERVAR";
            String reason = buildReason(w1, w6, w24, down24, loss24, reboots, audit);
            String recommendation = recommended
                    ? "Recomendado abrir GLPI de investigação: verificar PoE/energia, cabo, porta do switch e logs UniFi."
                    : "Manter em observação. Abrir GLPI se repetir, virar perda total ou afetar usuários.";

            items.add(new UnifiApInstabilityItem(
                    apName,
                    textField(ap, "ip"), textField(ap, "mac"), status, tone,
                    w1.samples, w6.samples, Math.max(w24.samples, intField(ap, "samples24h", 0)),
                    w1.downSamples, w6.downSamples, down24,
                    w1.lossSamples, w6.lossSamples, loss24,
                    w1.downWindows, w6.downWindows, w24.downWindows,
                    offlineMin, reboots, audit, intField(ap, "currentClientCount", 0),
                    textField(ap, "switchName"), textField(ap, "switchPort"),
                    recommended, score, recommendation, reason));
        }
        items.sort(Comparator.comparing(UnifiApInstabilityItem::ticketRecommended).reversed()
                .thenComparing(UnifiApInstabilityItem::score).reversed()
                .thenComparing(UnifiApInstabilityItem::apName, String.CASE_INSENSITIVE_ORDER));
        int recommended = (int) items.stream().filter(UnifiApInstabilityItem::ticketRecommended).count();
        int windows = items.stream().mapToInt(UnifiApInstabilityItem::downWindows24h).sum();
        int offline = items.stream().mapToInt(UnifiApInstabilityItem::estimatedOfflineMinutes24h).sum();
        return new UnifiApInstabilitySummary(names.size(), items.size(), recommended, windows, offline, items);
    }

    @Transactional
    public Map<String, Object> createInvestigationTicket(String apName, String customReason) {
        UnifiApInstabilityItem item = getInstability().items().stream()
                .filter(i -> i.apName().equalsIgnoreCase(apName))
                .findFirst()
                .orElseThrow(() -> new NoSuchElementException("AP não encontrado na lista de instabilidade"));
        Optional<Integer> existing = findOpenTicket(item.apName());
        if (existing.isPresent()) {
            addFollowup(existing.get(), "Nova solicitação pela Central de APs instáveis. O chamado já existia para este AP.\n\n" + item.reason());
            return Map.of("ticketId", existing.get(), "created", false, "apName", item.apName(), "message", "Chamado aberto já existia; adicionado follow-up.");
        }
        int ticketId = createTicket(item, customReason);
        return Map.of("ticketId", ticketId, "created", true, "apName", item.apName(), "message", "Chamado GLPI criado.");
    }

    private int createTicket(UnifiApInstabilityItem item, String customReason) {
        String marker = marker(item.apName());
        String title = "[UniFi] Investigar instabilidade do AP " + item.apName();
        String content = "Chamado criado pela Central de APs Instáveis do NexusIT.\n\n" +
                "AP: " + item.apName() + "\n" +
                "IP: " + nullSafe(item.ip()) + "\n" +
                "MAC: " + nullSafe(item.mac()) + "\n" +
                "Switch/porta: " + nullSafe(item.switchName()) + " / " + nullSafe(item.switchPort()) + "\n" +
                "Clientes atuais: " + item.currentClients() + "\n\n" +
                "Evidência 24h:\n" +
                "- Janelas de queda: " + item.downWindows24h() + "\n" +
                "- Amostras down: " + item.downSamples24h() + "\n" +
                "- Perda parcial: " + item.lossSamples24h() + "\n" +
                "- Tempo offline estimado: " + item.estimatedOfflineMinutes24h() + " min\n" +
                "- Reboots: " + item.reboots24h() + "\n" +
                "- Eventos auditoria: " + item.auditEvents24h() + "\n\n" +
                "Motivo: " + (customReason == null || customReason.isBlank() ? item.reason() : customReason.trim()) + "\n\n" +
                "Próxima ação: verificar PoE/energia, cabo, porta do switch, logs da controladora UniFi e se clientes foram afetados.\n\n" + marker;
        Map<String, Object> input = new LinkedHashMap<>();
        input.put("name", title.length() > 250 ? title.substring(0, 250) : title);
        input.put("content", content);
        input.put("entities_id", 0);
        input.put("itilcategories_id", glpiCategoryId);
        input.put("priority", item.ticketRecommended() ? 4 : 3);
        input.put("urgency", item.ticketRecommended() ? 4 : 3);
        input.put("impact", item.currentClients() > 10 ? 4 : 3);
        input.put("type", 1);
        input.put("status", 2);
        input.put("_users_id_assign", glpiAssignUserId);
        Map<String, Object> data = glpiClient.post("/Ticket", Map.of("input", input));
        Object id = data != null ? data.get("id") : null;
        if (id == null && data != null && data.get("input") instanceof Map<?, ?> m) id = m.get("id");
        if (id == null) throw new IllegalStateException("GLPI não retornou ID do chamado");
        return Integer.parseInt(String.valueOf(id));
    }

    private Optional<Integer> findOpenTicket(String apName) {
        String marker = marker(apName);
        try {
            List<Map<String, Object>> rows = glpiClient.getList("/Ticket", Map.of(
                    "range", "0-199", "expand_dropdowns", "true", "get_hateoas", "false", "is_deleted", "0", "order", "DESC", "sort", "date_mod"));
            if (rows == null) return Optional.empty();
            for (Map<String, Object> row : rows) {
                int status = intVal(row.get("status"));
                if (status >= 5) continue;
                String name = String.valueOf(row.getOrDefault("name", ""));
                if (name.contains("[UniFi]") && name.toLowerCase(Locale.ROOT).contains(apName.toLowerCase(Locale.ROOT))) {
                    return Optional.of(intVal(row.get("id")));
                }
                String content = String.valueOf(row.getOrDefault("content", ""));
                if (content.contains(marker)) return Optional.of(intVal(row.get("id")));
            }
        } catch (Exception ignored) { }
        return Optional.empty();
    }

    private void addFollowup(int ticketId, String content) {
        try {
            glpiClient.post("/Ticket/" + ticketId + "/ITILFollowup", Map.of("input", Map.of(
                    "items_id", ticketId,
                    "content", content)));
        } catch (Exception ignored) { }
    }

    private Map<String, JsonNode> readSnapshotAps() {
        if (!Files.exists(UNIFI_AP_SNAPSHOT)) return Map.of();
        try {
            JsonNode root = objectMapper.readTree(UNIFI_AP_SNAPSHOT.toFile());
            JsonNode aps = root.path("aps");
            if (!aps.isArray()) return Map.of();
            Map<String, JsonNode> out = new LinkedHashMap<>();
            for (JsonNode ap : aps) {
                String name = ap.path("name").asText(null);
                if (name != null && !name.isBlank()) out.put(name, ap);
            }
            return out;
        } catch (Exception e) {
            return Map.of();
        }
    }

    private WindowStats stats(List<UnifiApMetricSample> samples, LocalDateTime since) {
        int count = 0, down = 0, loss = 0, windows = 0;
        boolean wasDown = false;
        for (UnifiApMetricSample s : samples) {
            if (s.getRecordedAt() == null || s.getRecordedAt().isBefore(since)) continue;
            count++;
            double lp = s.getLossPct() == null ? 0 : s.getLossPct();
            boolean isDown = lp >= 100;
            if (isDown) down++;
            if (lp > 0) loss++;
            if (isDown && !wasDown) windows++;
            wasDown = isDown;
        }
        return new WindowStats(count, down, loss, windows);
    }

    private String buildReason(WindowStats w1, WindowStats w6, WindowStats w24, int down24, int loss24, int reboots, int audit) {
        List<String> parts = new ArrayList<>();
        if (w24.downWindows > 0) parts.add(w24.downWindows + " janela(s) de queda em 24h");
        if (down24 > 0) parts.add(down24 + " amostra(s) sem resposta em 24h");
        if (loss24 > 0) parts.add(loss24 + " amostra(s) com perda parcial em 24h");
        if (w6.lossSamples > 0) parts.add(w6.lossSamples + " perda(s) nas últimas 6h");
        if (w1.lossSamples > 0) parts.add(w1.lossSamples + " perda(s) na última 1h");
        if (reboots > 0) parts.add(reboots + " reboot(s) em 24h");
        if (audit > 0) parts.add(audit + " evento(s) de auditoria em 24h");
        return parts.isEmpty() ? "Sem instabilidade relevante no período." : String.join("; ", parts) + ".";
    }

    private String marker(String apName) { return "UNIFI_AP_INSTABILITY:" + apName; }
    private static String nullSafe(String s) { return s == null || s.isBlank() ? "—" : s; }
    private static String textField(JsonNode node, String field) { return node == null || node.get(field) == null || node.get(field).isNull() ? null : node.get(field).asText(); }
    private static int intField(JsonNode node, String field, int fallback) { return node == null || node.get(field) == null || !node.get(field).isNumber() ? fallback : node.get(field).asInt(); }
    private static int intVal(Object value) { try { return Integer.parseInt(String.valueOf(value)); } catch (Exception e) { return 0; } }
    private record WindowStats(int samples, int downSamples, int lossSamples, int downWindows) {}
}
