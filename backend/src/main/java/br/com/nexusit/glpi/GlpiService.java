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

    public void assignTicket(int ticketId, int glpiUserId) {
        // Add assignment (type 2 = assigned tech)
        Map<String, Object> body = Map.of("input", Map.of(
                "tickets_id", ticketId,
                "users_id", glpiUserId,
                "type", 2));
        client.post("/Ticket_User", body);
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

    public int createTicket(String title, String content, int requesterGlpiUserId) {
        Map<String, Object> resp = client.post("/Ticket", Map.of("input", Map.of(
                "name", title,
                "content", content,
                "_users_id_requester", requesterGlpiUserId)));
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
