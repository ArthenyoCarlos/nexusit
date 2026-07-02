package br.com.nexusit.glpi;

import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Service;

import java.util.*;
import java.util.function.Supplier;

@Service
@RequiredArgsConstructor
@Slf4j
public class GlpiService {

    private final GlpiClient client;

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

            return raw.stream()
                    .filter(t -> {
                        int s = intVal(t, "status");
                        if (status != null) return s == status;
                        return s <= 4; // open: 1,2,3,4
                    })
                    .map(this::toTicket)
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
            GlpiTicket ticket = toTicket(raw);
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

    // ── Actions ───────────────────────────────────────────────────────────

    public void addFollowup(int ticketId, String content) {
        safeCall(() -> {
            Map<String, Object> body = Map.of(
                    "input", Map.of("tickets_id", ticketId, "content", content));
            client.post("/Ticket/" + ticketId + "/ITILFollowup", body);
            return null;
        }, null);
    }

    public void closeTicket(int ticketId) {
        safeCall(() -> {
            Map<String, Object> body = Map.of("input", Map.of("status", 6));
            client.put("/Ticket/" + ticketId, body);
            return null;
        }, null);
    }

    public void assignTicket(int ticketId, int glpiUserId) {
        safeCall(() -> {
            // Add assignment (type 2 = assigned tech)
            Map<String, Object> body = Map.of("input", Map.of(
                    "tickets_id", ticketId,
                    "users_id", glpiUserId,
                    "type", 2));
            client.post("/Ticket_User", body);
            return null;
        }, null);
    }

    // ── Parsing ───────────────────────────────────────────────────────────

    private GlpiTicket toTicket(Map<String, Object> t) {
        int status = intVal(t, "status");
        int priority = intVal(t, "priority");
        int type = intVal(t, "type");

        // GLPI with expand_dropdowns=true returns user names in _users_id_requester / _users_id_assign
        // For the list endpoint these may be absent; fall back to empty string
        String requester = firstNonEmpty(t, "_users_id_requester", "users_id_requester_1", "users_id_requester");
        String assignedTo = firstNonEmpty(t, "_users_id_assign", "users_id_assign_1", "users_id_assign");

        return new GlpiTicket(
                intVal(t, "id"),
                str(t, "name"),
                status, STATUS_LABELS.getOrDefault(status, "?"),
                priority, PRIORITY_LABELS.getOrDefault(priority, "?"),
                requester,
                assignedTo,
                str(t, "date"),
                str(t, "solvedate"),
                type
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
