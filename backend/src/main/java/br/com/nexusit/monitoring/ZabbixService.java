package br.com.nexusit.monitoring;

import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Service;

import java.util.*;
import java.util.function.Supplier;

@Service
@RequiredArgsConstructor
@Slf4j
public class ZabbixService {

    private final ZabbixClient client;

    private static final Map<Integer, String> SEVERITY_LABELS = Map.of(
            0, "Não Classificado",
            1, "Info",
            2, "Warning",
            3, "Average",
            4, "High",
            5, "Disaster"
    );

    // ── Hosts ─────────────────────────────────────────────────────────────

    @SuppressWarnings("unchecked")
    public List<ZabbixHost> getHosts() {
        return safeCall(() -> {
            Map<String, Object> params = new LinkedHashMap<>();
            params.put("output", List.of("hostid", "host", "name", "status", "available"));
            params.put("selectInterfaces", List.of("ip", "main"));
            params.put("monitored_hosts", 1);

            List<Map<String, Object>> raw = client.call("host.get", params);

            // Fetch uptime for all hosts in one call
            Map<String, Long> uptimeMap = fetchUptimeForAllHosts();

            return raw.stream().map(h -> {
                String id = str(h, "hostid");
                String name = str(h, "name");
                boolean monitored = "0".equals(str(h, "status"));
                boolean available = "1".equals(str(h, "available"));

                List<Map<String, Object>> ifaces = (List<Map<String, Object>>) h.get("interfaces");
                String ip = "";
                if (ifaces != null) {
                    ip = ifaces.stream()
                            .filter(i -> "1".equals(String.valueOf(i.get("main"))))
                            .findFirst()
                            .map(i -> str(i, "ip"))
                            .orElse(ifaces.isEmpty() ? "" : str(ifaces.get(0), "ip"));
                }

                return new ZabbixHost(id, name, ip, monitored, available, uptimeMap.get(id));
            }).toList();
        }, List.of());
    }

    @SuppressWarnings("unchecked")
    private Map<String, Long> fetchUptimeForAllHosts() {
        try {
            Map<String, Object> params = new LinkedHashMap<>();
            params.put("output", List.of("itemid", "hostid", "lastvalue"));
            params.put("monitored", true);
            params.put("filter", Map.of("key_", List.of("system.uptime")));

            List<Map<String, Object>> items = client.call("item.get", params);
            Map<String, Long> result = new HashMap<>();
            for (Map<String, Object> item : items) {
                String hostId = str(item, "hostid");
                String lastVal = str(item, "lastvalue");
                if (!lastVal.isBlank()) {
                    try { result.put(hostId, Long.parseLong(lastVal.split("\\.")[0])); }
                    catch (NumberFormatException ignored) {}
                }
            }
            return result;
        } catch (Exception e) {
            log.debug("Could not fetch uptime items: {}", e.getMessage());
            return Map.of();
        }
    }

    // ── Problems ──────────────────────────────────────────────────────────

    @SuppressWarnings("unchecked")
    public List<ZabbixProblem> getProblems() {
        return safeCall(() -> {
            Map<String, Object> params = new LinkedHashMap<>();
            params.put("output", List.of("eventid", "objectid", "name", "severity", "clock"));
            params.put("selectHosts", List.of("hostid", "name"));
            params.put("recent", true);
            params.put("sortfield", List.of("severity", "clock"));
            params.put("sortorder", "DESC");

            List<Map<String, Object>> raw = client.call("problem.get", params);

            return raw.stream().map(p -> {
                int sev = intVal(p, "severity");
                List<Map<String, Object>> hosts = (List<Map<String, Object>>) p.get("hosts");
                String hostName = (hosts != null && !hosts.isEmpty()) ? str(hosts.get(0), "name") : "Desconhecido";
                return new ZabbixProblem(
                        str(p, "eventid"),
                        str(p, "name"),
                        sev,
                        SEVERITY_LABELS.getOrDefault(sev, "?"),
                        hostName,
                        longVal(p, "clock")
                );
            }).toList();
        }, List.of());
    }

    // ── Host Metrics ──────────────────────────────────────────────────────

    @SuppressWarnings("unchecked")
    public ZabbixMetrics getHostMetrics(String hostId) {
        return safeCall(() -> {
            // CPU item
            Double cpuPercent = null;
            Double memPercent = null;
            Long uptimeSeconds = null;
            List<ZabbixMetrics.CpuDataPoint> cpuHistory = List.of();

            Map<String, Object> itemParams = new LinkedHashMap<>();
            itemParams.put("output", List.of("itemid", "key_", "lastvalue"));
            itemParams.put("hostids", List.of(hostId));
            itemParams.put("monitored", true);
            itemParams.put("filter", Map.of("key_", List.of(
                    "system.cpu.util", "system.cpu.util[,idle]",
                    "vm.memory.size[pavailable]", "vm.memory.size[pused]",
                    "system.uptime"
            )));

            List<Map<String, Object>> items = client.call("item.get", itemParams);

            String cpuItemId = null;
            for (Map<String, Object> item : items) {
                String key = str(item, "key_");
                String val = str(item, "lastvalue");
                if (val.isBlank()) continue;
                double dval = parseDouble(val);

                if (key.startsWith("system.cpu.util") && !key.contains("idle")) {
                    cpuPercent = dval;
                    cpuItemId = str(item, "itemid");
                } else if (key.contains("idle")) {
                    cpuPercent = 100.0 - dval;
                    cpuItemId = str(item, "itemid");
                } else if (key.equals("vm.memory.size[pavailable]")) {
                    memPercent = 100.0 - dval;
                } else if (key.equals("vm.memory.size[pused]")) {
                    memPercent = dval;
                } else if (key.equals("system.uptime")) {
                    uptimeSeconds = (long) dval;
                }
            }

            // CPU history (last 2h)
            if (cpuItemId != null) {
                long timeFrom = System.currentTimeMillis() / 1000 - 7200;
                Map<String, Object> histParams = new LinkedHashMap<>();
                histParams.put("itemids", List.of(cpuItemId));
                histParams.put("history", 0); // float
                histParams.put("time_from", timeFrom);
                histParams.put("sortfield", "clock");
                histParams.put("sortorder", "ASC");
                histParams.put("limit", 120);

                try {
                    List<Map<String, Object>> hist = client.call("history.get", histParams);
                    cpuHistory = hist.stream().map(h -> new ZabbixMetrics.CpuDataPoint(
                            longVal(h, "clock"),
                            parseDouble(str(h, "value"))
                    )).toList();
                } catch (Exception e) {
                    log.debug("CPU history fetch failed: {}", e.getMessage());
                }
            }

            return new ZabbixMetrics(hostId, cpuPercent, memPercent, uptimeSeconds, cpuHistory);
        }, new ZabbixMetrics(hostId, null, null, null, List.of()));
    }

    // ── Recent History ────────────────────────────────────────────────────

    @SuppressWarnings("unchecked")
    public List<ZabbixHistoryEntry> getRecentHistory(int hours) {
        return safeCall(() -> {
            long timeFrom = System.currentTimeMillis() / 1000 - (long) hours * 3600;

            Map<String, Object> params = new LinkedHashMap<>();
            params.put("output", List.of("eventid", "objectid", "name", "severity", "clock", "r_clock"));
            params.put("selectHosts", List.of("name"));
            params.put("time_from", timeFrom);
            params.put("value", 1);  // 1 = problem events
            params.put("object", 0); // 0 = triggers
            params.put("sortfield", "clock");
            params.put("sortorder", "DESC");
            params.put("limit", 200);

            List<Map<String, Object>> raw = client.call("event.get", params);

            return raw.stream().map(e -> {
                int sev = intVal(e, "severity");
                List<Map<String, Object>> hosts = (List<Map<String, Object>>) e.get("hosts");
                String hostName = (hosts != null && !hosts.isEmpty()) ? str(hosts.get(0), "name") : "Desconhecido";
                String rClock = str(e, "r_clock");
                Long resolvedAt = (!rClock.isBlank() && !"0".equals(rClock)) ? Long.parseLong(rClock) : null;

                return new ZabbixHistoryEntry(
                        str(e, "eventid"),
                        str(e, "name"),
                        sev,
                        SEVERITY_LABELS.getOrDefault(sev, "?"),
                        hostName,
                        longVal(e, "clock"),
                        resolvedAt
                );
            }).toList();
        }, List.of());
    }

    // ── Helpers ───────────────────────────────────────────────────────────

    private <T> T safeCall(Supplier<T> supplier, T fallback) {
        try {
            return supplier.get();
        } catch (Exception e) {
            log.warn("Zabbix call failed: {}", e.getMessage());
            return fallback;
        }
    }

    private String str(Map<String, Object> map, String key) {
        Object val = map.get(key);
        return val == null ? "" : String.valueOf(val);
    }

    private int intVal(Map<String, Object> map, String key) {
        try { return Integer.parseInt(str(map, key)); }
        catch (NumberFormatException e) { return 0; }
    }

    private long longVal(Map<String, Object> map, String key) {
        try { return Long.parseLong(str(map, key)); }
        catch (NumberFormatException e) { return 0; }
    }

    private double parseDouble(String val) {
        try { return Double.parseDouble(val); }
        catch (NumberFormatException e) { return 0.0; }
    }
}
