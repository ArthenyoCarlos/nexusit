package br.com.nexusit.glpi;

import com.fasterxml.jackson.databind.ObjectMapper;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.core.io.ByteArrayResource;
import org.springframework.http.HttpEntity;
import org.springframework.http.HttpHeaders;
import org.springframework.http.MediaType;
import org.springframework.stereotype.Service;
import org.springframework.util.LinkedMultiValueMap;
import org.springframework.util.MultiValueMap;

import java.text.Normalizer;
import java.util.*;
import java.util.function.Supplier;

@Service
@RequiredArgsConstructor
@Slf4j
public class GlpiService {

    private final GlpiClient client;
    private final ObjectMapper objectMapper;

    // Status: 1=Novo, 2=Em andamento (atribuído), 3=Em andamento (planejado),
    //         4=Aguardando, 5=Resolvido, 6=Fechado
    private static final Map<Integer, String> STATUS_LABELS = Map.of(
            1, "Novo",
            2, "Em andamento",
            3, "Em andamento",
            4, "Aguardando",
            5, "Resolvido",
            6, "Fechado"
    );

    // Priority: 1=Muito Baixa, 2=Baixa, 3=Média, 4=Alta, 5=Muito Alta, 6=Crítica
    private static final Map<Integer, String> PRIORITY_LABELS = Map.of(
            1, "Muito Baixa",
            2, "Baixa",
            3, "Média",
            4, "Alta",
            5, "Muito Alta",
            6, "Crítica"
    );

    // Urgência/Impacto: 1=Muito Baixa, 2=Baixa, 3=Média, 4=Alta, 5=Muito Alta
    private static final Map<Integer, String> URGENCY_IMPACT_LABELS = Map.of(
            1, "Muito Baixa",
            2, "Baixa",
            3, "Média",
            4, "Alta",
            5, "Muito Alta"
    );

    // ── Tickets ───────────────────────────────────────────────────────────

    public List<GlpiTicket> getTickets(Integer status) {
        return safeCall(() -> {
            Map<String, String> params = new LinkedHashMap<>();
            params.put("range", "0-199");
            params.put("expand_dropdowns", "true");
            params.put("get_hateoas", "false");
            params.put("is_deleted", "0");
            params.put("order", "DESC");
            params.put("sort", "date_mod"); // sort by date_mod

            List<Map<String, Object>> raw = client.getList("/Ticket", params);
            if (raw == null) return List.of();

            ActorMaps actors = fetchActorMaps();

            return raw.stream()
                    .filter(t -> {
                        int s = intVal(t, "status");
                        if (status != null) return s == status;
                        return s <= 4; // open: 1,2,3,4
                    })
                    .map(t -> withActors(toTicket(t), actors))
                    .toList();
        }, List.of());
    }

    public GlpiTicketDetail getTicketById(int id) {
        return safeCall(() -> {
            Map<String, String> params = Map.of(
                    "expand_dropdowns", "true",
                    "get_hateoas", "false"
            );
            Map<String, Object> raw = client.getOne("/Ticket/" + id, params);
            GlpiTicket ticket = withResolvedAssignee(toTicket(raw));
            String content = str(raw, "content");

            // Followups
            List<GlpiFollowup> followups = List.of();
            try {
                List<Map<String, Object>> rawFollowups = client.getList(
                        "/Ticket/" + id + "/ITILFollowup",
                        Map.of("expand_dropdowns", "true", "get_hateoas", "false"));
                if (rawFollowups != null) {
                    followups = rawFollowups.stream().map(f -> new GlpiFollowup(
                            intVal(f, "id"),
                            str(f, "users_id"),       // expanded to name with expand_dropdowns
                            str(f, "content"),
                            str(f, "date")
                    )).toList();
                }
            } catch (Exception e) {
                log.debug("Could not fetch followups for ticket {}: {}", id, e.getMessage());
            }

            return new GlpiTicketDetail(ticket, content, followups);
        }, null);
    }

    /**
     * GLPI não preenche "_users_id_assign"/"_users_id_requester" nas respostas de /Ticket
     * (lista ou item único) — não são colunas reais da tabela do chamado, ficam na tabela
     * pivô glpi_tickets_users (type 1 = solicitante, 2 = técnico), e expand_dropdowns não
     * alcança isso. ActorMaps + fetchActorMaps() resolvem isso em UMA chamada bulk a
     * /Ticket_User (sem N+1) pra usar em getTickets(); getTicketById() resolve só o chamado
     * aberto, então usa o sub-recurso por ticket (mais barato pra um item só).
     */
    private record ActorMaps(Map<Integer, String> assignees, Map<Integer, String> requesters) {}

    private ActorMaps fetchActorMaps() {
        return safeCall(() -> {
            Map<String, String> params = new LinkedHashMap<>();
            params.put("range", "0-1999");
            params.put("expand_dropdowns", "true");
            params.put("get_hateoas", "false");
            params.put("order", "DESC");
            params.put("sort", "id"); // se truncar pelo range, prioriza os vinculos mais recentes
            List<Map<String, Object>> rows = client.getList("/Ticket_User", params);

            Map<Integer, String> assignees = new LinkedHashMap<>();
            Map<Integer, String> requesters = new LinkedHashMap<>();
            if (rows != null) {
                for (Map<String, Object> r : rows) {
                    String name = str(r, "users_id");
                    if (name == null || name.isBlank()) continue;
                    int ticketId = intVal(r, "tickets_id");
                    int type = intVal(r, "type");
                    if (type == 2) assignees.putIfAbsent(ticketId, name);
                    else if (type == 1) requesters.putIfAbsent(ticketId, name);
                }
            }
            return new ActorMaps(assignees, requesters);
        }, new ActorMaps(Map.of(), Map.of()));
    }

    private GlpiTicket withActors(GlpiTicket t, ActorMaps actors) {
        String assignedTo = (t.assignedTo() == null || t.assignedTo().isBlank())
                ? actors.assignees().get(t.id()) : t.assignedTo();
        String requester = (t.requester() == null || t.requester().isBlank())
                ? actors.requesters().get(t.id()) : t.requester();
        if (assignedTo == null) assignedTo = t.assignedTo();
        if (requester == null) requester = t.requester();
        return new GlpiTicket(t.id(), t.title(), t.status(), t.statusLabel(), t.priority(), t.priorityLabel(),
                t.urgency(), t.urgencyLabel(), t.impact(), t.impactLabel(), t.category(), requester,
                assignedTo, t.openedAt(), t.solvedAt(), t.ticketType(), t.slaTtoName(), t.slaTtrName(),
                t.timeToOwn(), t.timeToResolve(), t.slaWaitingDuration());
    }

    private GlpiTicket withResolvedAssignee(GlpiTicket t) {
        if (t.assignedTo() != null && !t.assignedTo().isBlank()) return t;
        String resolved = resolveAssignedTechnician(t.id());
        if (resolved.isBlank()) return t;
        return new GlpiTicket(t.id(), t.title(), t.status(), t.statusLabel(), t.priority(), t.priorityLabel(),
                t.urgency(), t.urgencyLabel(), t.impact(), t.impactLabel(), t.category(), t.requester(),
                resolved, t.openedAt(), t.solvedAt(), t.ticketType(), t.slaTtoName(), t.slaTtrName(),
                t.timeToOwn(), t.timeToResolve(), t.slaWaitingDuration());
    }

    private String resolveAssignedTechnician(int ticketId) {
        return safeCall(() -> {
            List<Map<String, Object>> rows = client.getList(
                    "/Ticket/" + ticketId + "/Ticket_User",
                    Map.of("expand_dropdowns", "true", "get_hateoas", "false"));
            if (rows == null) return "";
            return rows.stream()
                    .filter(r -> intVal(r, "type") == 2)
                    .map(r -> str(r, "users_id"))
                    .filter(s -> s != null && !s.isBlank())
                    .findFirst()
                    .orElse("");
        }, "");
    }

    // ── Actions ───────────────────────────────────────────────────────────

    public void addFollowup(int ticketId, String content) {
        Map<String, Object> body = Map.of(
                "input", Map.of(
                        "itemtype", "Ticket",
                        "items_id", ticketId,
                        "content", content));
        client.post("/Ticket/" + ticketId + "/ITILFollowup", body);
    }

    public void closeTicket(int ticketId) {
        Map<String, Object> body = Map.of("input", Map.of("status", 6));
        client.put("/Ticket/" + ticketId, body);
    }

    public void updateTicket(int ticketId, Map<String, Object> fields) {
        client.put("/Ticket/" + ticketId, Map.of("input", fields));
    }

    public Integer assignTicket(int ticketId, int glpiUserId) {
        // Add assignment (type 2 = assigned tech). Returns the created Ticket_User row id
        // so it can be targeted later by unassignTicket (e.g. when transferring a ticket).
        return safeCall(() -> {
            Map<String, Object> body = Map.of("input", Map.of(
                    "tickets_id", ticketId,
                    "users_id", glpiUserId,
                    "type", 2));
            Map<String, Object> resp = client.post("/Ticket_User", body);
            return resp == null ? null : intVal(resp, "id");
        }, null);
    }

    public void unassignTicket(Integer ticketUserId) {
        if (ticketUserId == null) return;
        safeCall(() -> {
            client.delete("/Ticket_User/" + ticketUserId);
            return null;
        }, null);
    }

    // ── Technicians ───────────────────────────────────────────────────────

    public List<Map<String, Object>> getTechnicians() {
        return safeCall(() -> {
            Map<String, String> params = new LinkedHashMap<>();
            params.put("range", "0-299");
            params.put("expand_dropdowns", "false");

            List<Map<String, Object>> raw = client.getList("/User", params);
            if (raw == null) return List.<Map<String, Object>>of();

            return raw.stream()
                    .filter(u -> intVal(u, "is_deleted") == 0)
                    .map(u -> {
                        Map<String, Object> m = new LinkedHashMap<>();
                        m.put("id", intVal(u, "id"));
                        m.put("name", technicianDisplayName(u));
                        return m;
                    })
                    .filter(m -> !String.valueOf(m.get("name")).isBlank())
                    .sorted(Comparator.comparing(m -> String.valueOf(m.get("name")).toLowerCase()))
                    .toList();
        }, List.of());
    }

    public List<Map<String, Object>> getCategories() {
        return safeCall(() -> {
            Map<String, String> params = new LinkedHashMap<>();
            params.put("range", "0-299");

            List<Map<String, Object>> raw = client.getList("/ITILCategory", params);
            if (raw == null) return List.<Map<String, Object>>of();

            return raw.stream()
                    .filter(c -> intVal(c, "is_deleted") == 0)
                    .map(c -> {
                        Map<String, Object> m = new LinkedHashMap<>();
                        m.put("id", intVal(c, "id"));
                        String name = str(c, "completename");
                        m.put("name", name.isBlank() ? str(c, "name") : name);
                        return m;
                    })
                    .filter(m -> !String.valueOf(m.get("name")).isBlank())
                    .sorted(Comparator.comparing(m -> String.valueOf(m.get("name")).toLowerCase()))
                    .toList();
        }, List.of());
    }

    private String technicianDisplayName(Map<String, Object> u) {
        String first = str(u, "firstname");
        String last = str(u, "realname");
        String login = str(u, "name");
        String full = (first + " " + last).trim();
        return full.isBlank() ? login : full + " (" + login + ")";
    }

    // ── Support/WhatsApp integration ─────────────────────────────────────

    public Optional<GlpiUserRef> findUserByName(String name) {
        return safeCall(() -> {
            Map<String, String> params = new LinkedHashMap<>();
            params.put("range", "0-299");
            List<Map<String, Object>> raw = client.getList("/User", params);
            if (raw == null) return Optional.<GlpiUserRef>empty();
            String needle = normalize(name);
            return raw.stream()
                    .filter(u -> intVal(u, "is_deleted") == 0)
                    .map(u -> new GlpiUserRef(intVal(u, "id"), fullName(u)))
                    .filter(u -> !u.name().isBlank() && normalize(u.name()).contains(needle))
                    .findFirst();
        }, Optional.empty());
    }

    public GlpiUserRef createUser(String fullName) {
        String[] parts = fullName.trim().split("\\s+", 2);
        String firstname = parts[0];
        String lastname = parts.length > 1 ? parts[1] : "";
        String login = slugifyLogin(fullName);

        Map<String, Object> resp;
        try {
            resp = client.post("/User", Map.of("input", Map.of(
                    "name", login, "firstname", firstname, "realname", lastname)));
        } catch (Exception e) {
            // login collision or transient error — retry once with a random numeric suffix
            resp = client.post("/User", Map.of("input", Map.of(
                    "name", login + (1000 + new Random().nextInt(9000)),
                    "firstname", firstname, "realname", lastname)));
        }
        return new GlpiUserRef(intVal(resp, "id"), fullName.trim());
    }

    public void linkWhatsappToUser(int glpiUserId, String phoneNumber) {
        safeCall(() -> {
            client.put("/User/" + glpiUserId, Map.of("input", Map.of(
                    "id", glpiUserId,
                    "phone2", phoneNumber,
                    "mobile", phoneNumber,
                    "comment", "WhatsApp vinculado pelo NexusIT: " + phoneNumber
            )));
            return null;
        }, null);
    }

    public List<GlpiTicket> getOpenTicketsForRequester(int requesterGlpiUserId) {
        return safeCall(() -> {
            Map<String, String> params = new LinkedHashMap<>();
            params.put("range", "0-199");
            params.put("expand_dropdowns", "false");
            params.put("get_hateoas", "false");
            params.put("is_deleted", "0");
            params.put("order", "DESC");
            params.put("sort", "date_mod");
            List<Map<String, Object>> raw = client.getList("/Ticket", params);
            if (raw == null) return List.<GlpiTicket>of();
            return raw.stream()
                    .filter(t -> intVal(t, "status") <= 4)
                    .filter(t -> intVal(t, "users_id_recipient") == requesterGlpiUserId
                            || intVal(t, "users_id_requester") == requesterGlpiUserId
                            || intVal(t, "_users_id_requester") == requesterGlpiUserId)
                    .map(this::toTicket)
                    .toList();
        }, List.of());
    }

    public int createTicket(String title, String content, int requesterGlpiUserId) {
        return createTicket(title, content, requesterGlpiUserId, 3, "Suporte TI");
    }

    public int createTicket(String title, String content, int requesterGlpiUserId, int priority, String category) {
        Map<String, Object> input = new LinkedHashMap<>();
        input.put("name", title);
        input.put("content", "[Categoria sugerida: " + (category == null || category.isBlank() ? "Suporte TI" : category) + "]\n\n" + content);
        input.put("_users_id_requester", requesterGlpiUserId);
        input.put("priority", priority);
        input.put("urgency", priority);
        input.put("impact", 3);
        Map<String, Object> resp = client.post("/Ticket", Map.of("input", input));
        return intVal(resp, "id");
    }

    public void uploadDocumentToTicket(int ticketId, byte[] bytes, String filename, String mime) {
        try {
            Map<String, Object> manifestMap = Map.of("input", Map.of(
                    "name", filename, "_filename", List.of(filename)));
            String manifest = objectMapper.writeValueAsString(manifestMap);

            HttpHeaders manifestHeaders = new HttpHeaders();
            manifestHeaders.setContentType(MediaType.TEXT_PLAIN);
            ByteArrayResource fileResource = new ByteArrayResource(bytes) {
                @Override public String getFilename() { return filename; }
            };

            MultiValueMap<String, Object> parts = new LinkedMultiValueMap<>();
            parts.add("uploadManifest", new HttpEntity<>(manifest, manifestHeaders));
            parts.add("filename[0]", fileResource);

            Map<String, Object> resp = client.postMultipart("/Document", parts);
            int documentId = intVal(resp, "id");
            if (documentId > 0) {
                client.post("/Document_Item", Map.of("input", Map.of(
                        "documents_id", documentId, "itemtype", "Ticket", "items_id", ticketId)));
            }
        } catch (Exception e) {
            log.warn("Falha ao anexar documento '{}' ao chamado {}: {}", filename, ticketId, e.getMessage());
        }
    }

    private String fullName(Map<String, Object> u) {
        String first = str(u, "firstname");
        String last = str(u, "realname");
        String full = (first + " " + last).trim();
        return full.isBlank() ? str(u, "name") : full;
    }

    private String normalize(String s) {
        if (s == null) return "";
        String n = Normalizer.normalize(s, Normalizer.Form.NFD).replaceAll("\\p{M}", "");
        return n.toLowerCase(Locale.ROOT).trim();
    }

    private String slugifyLogin(String fullName) {
        String n = normalize(fullName).replaceAll("[^a-z0-9]+", ".").replaceAll("^\\.+|\\.+$", "");
        return n.isBlank() ? "user" + System.currentTimeMillis() : n;
    }

    // ── Parsing ───────────────────────────────────────────────────────────

    private GlpiTicket toTicket(Map<String, Object> t) {
        int status = intVal(t, "status");
        int priority = intVal(t, "priority");
        int urgency = intVal(t, "urgency");
        int impact = intVal(t, "impact");
        int type = intVal(t, "type");

        // GLPI with expand_dropdowns=true returns user names in _users_id_requester / _users_id_assign
        // For the list endpoint these may be absent; fall back to empty string
        String requester = firstNonEmpty(t, "_users_id_requester", "users_id_requester_1", "users_id_requester");
        String assignedTo = firstNonEmpty(t, "_users_id_assign", "users_id_assign_1", "users_id_assign");
        // itilcategories_id also arrives expanded to its display name (or "0"/blank when uncategorized)
        String category = nonZeroStr(t, "itilcategories_id");

        return new GlpiTicket(
                intVal(t, "id"),
                str(t, "name"),
                status, STATUS_LABELS.getOrDefault(status, "?"),
                priority, PRIORITY_LABELS.getOrDefault(priority, "?"),
                urgency, URGENCY_IMPACT_LABELS.getOrDefault(urgency, "?"),
                impact, URGENCY_IMPACT_LABELS.getOrDefault(impact, "?"),
                category,
                requester,
                assignedTo,
                str(t, "date"),
                str(t, "solvedate"),
                type,
                nonZeroStr(t, "slas_id_tto"),
                nonZeroStr(t, "slas_id_ttr"),
                str(t, "time_to_own"),
                str(t, "time_to_resolve"),
                intVal(t, "sla_waiting_duration")
        );
    }

    // ── Utils ─────────────────────────────────────────────────────────────

    private <T> T safeCall(Supplier<T> supplier, T fallback) {
        try {
            return supplier.get();
        } catch (Exception e) {
            log.warn("GLPI call failed: {}", e.getMessage());
            return fallback;
        }
    }

    private String str(Map<String, Object> m, String key) {
        Object v = m.get(key);
        if (v == null) return "";
        String s = String.valueOf(v);
        return "null".equals(s) ? "" : s;
    }

    private String nonZeroStr(Map<String, Object> m, String key) {
        String s = str(m, key);
        return "0".equals(s) ? "" : s;
    }

    private int intVal(Map<String, Object> m, String key) {
        Object v = m.get(key);
        if (v == null) return 0;
        try { return Integer.parseInt(String.valueOf(v)); }
        catch (NumberFormatException e) { return 0; }
    }

    private String firstNonEmpty(Map<String, Object> m, String... keys) {
        for (String key : keys) {
            String val = str(m, key);
            if (!val.isBlank()) return val;
        }
        return "";
    }
}
