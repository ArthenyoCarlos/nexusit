package br.com.nexusit.monitoring;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
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
    private final ObjectMapper objectMapper;

    // Item definido no template "Galdino - Notebooks Windows Essencial" — so existe em
    // hosts com esse template aplicado (notebooks), nao em servidores/outros hosts.
    private static final String TEMPERATURE_ITEM_KEY =
            "wmi.getall[root\\wmi,\"SELECT CurrentTemperature,InstanceName FROM MSAcpi_ThermalZoneTemperature\"]";

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
            params.put("output", List.of("hostid", "host", "name", "status"));
            params.put("selectInterfaces", List.of("ip", "main"));
            params.put("monitored_hosts", 1);

            List<Map<String, Object>> raw = client.call("host.get", params);

            // Fetch uptime for all hosts in one call
            Map<String, Long> uptimeMap = fetchUptimeForAllHosts();

            return raw.stream().map(h -> {
                String id = str(h, "hostid");
                String name = str(h, "name");
                boolean monitored = "0".equals(str(h, "status"));
                boolean available = "0".equals(str(h, "status"));

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
        // Busca mapa de hostid -> nome
        Map<String, Object> hostParams = new LinkedHashMap<>();
        hostParams.put("output", List.of("hostid", "name"));
        List<Map<String, Object>> hostList = client.call("host.get", hostParams);
        Map<String, String> hostMap = new HashMap<>();
        for (Map<String, Object> h : hostList) {
            hostMap.put(str(h, "hostid"), str(h, "name"));
        }

        Map<String, Object> params = new LinkedHashMap<>();
        params.put("output", List.of("eventid", "objectid", "name", "severity", "clock"));
        // Match Monitoring > Problems: only current/open problems. Recent/resolved
        // events are history and must not feed the active-alert dashboard.
        params.put("recent", false);
        params.put("sortfield", "eventid");
        params.put("sortorder", "DESC");

        List<Map<String, Object>> raw = client.call("problem.get", params);

        // Busca triggers para mapear objectid -> host e filtrar eventos obsoletos.
        // A API pode manter eventos antigos com r_eventid=0 mesmo depois que o
        // trigger/item foi desabilitado; a tela Monitoring > Problems esconde
        // esses casos, então o NexusIT deve esconder também.
        List<String> triggerIds = raw.stream()
                .map(p -> str(p, "objectid"))
                .filter(id -> !id.isBlank())
                .distinct()
                .toList();

        Map<String, Map<String, Object>> triggerMap = new HashMap<>();
        if (!triggerIds.isEmpty()) {
            Map<String, Object> trigParams = new LinkedHashMap<>();
            trigParams.put("output", List.of("triggerid", "status", "value", "state"));
            trigParams.put("selectHosts", List.of("hostid", "name", "status", "maintenance_status"));
            trigParams.put("selectItems", List.of("itemid", "name", "key_", "status", "state", "lastclock"));
            trigParams.put("triggerids", triggerIds);
            List<Map<String, Object>> triggers = client.call("trigger.get", trigParams);
            for (Map<String, Object> t : triggers) {
                triggerMap.put(str(t, "triggerid"), t);
            }
        }

        return raw.stream()
                .filter(p -> isVisibleActiveProblem(p, triggerMap.get(str(p, "objectid"))))
                .map(p -> {
                    int sev = intVal(p, "severity");
                    String triggerId = str(p, "objectid");
                    Map<String, Object> trigger = triggerMap.get(triggerId);
                    String hostName = hostNameFromTrigger(trigger);
                    String hostId = hostIdFromTrigger(trigger);
                    return new ZabbixProblem(
                            str(p, "eventid"),
                            str(p, "name"),
                            sev,
                            SEVERITY_LABELS.getOrDefault(sev, "?"),
                            hostName,
                            longVal(p, "clock"),
                            hostId
                    );
                }).toList();
    }, List.of());
}

    // ── Host Metrics ──────────────────────────────────────────────────────

    @SuppressWarnings("unchecked")
    public ZabbixMetrics getHostMetrics(String hostId, int hours) {
        return safeCall(() -> {
            Double cpuPercent = null;
            Double memPercent = null;
            Double diskPercent = null;
            Long uptimeSeconds = null;

            Map<String, Object> itemParams = new LinkedHashMap<>();
            itemParams.put("output", List.of("itemid", "key_", "lastvalue"));
            itemParams.put("hostids", List.of(hostId));
            itemParams.put("monitored", true);
            itemParams.put("filter", Map.of("key_", List.of(
                    "system.cpu.util", "system.cpu.util[,idle]",
                    "vm.memory.size[pavailable]", "vm.memory.size[pused]",
                    "system.uptime", "vfs.fs.size[C:,pused]"
            )));

            List<Map<String, Object>> items = client.call("item.get", itemParams);

            String cpuItemId = null;
            String memItemId = null;
            String diskItemId = null;
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
                    memItemId = str(item, "itemid");
                } else if (key.equals("vm.memory.size[pused]")) {
                    memPercent = dval;
                    memItemId = str(item, "itemid");
                } else if (key.equals("system.uptime")) {
                    uptimeSeconds = (long) dval;
                } else if (key.equals("vfs.fs.size[C:,pused]")) {
                    diskPercent = dval;
                    diskItemId = str(item, "itemid");
                }
            }

            NetworkItems net = findNetworkItems(hostId);
            TemperatureItem temp = findTemperatureItem(hostId);

            long timeFrom = System.currentTimeMillis() / 1000 - (long) hours * 3600;
            List<ZabbixMetrics.MetricPoint> cpuHistory = cpuItemId != null ? fetchItemHistory(cpuItemId, 0, timeFrom) : List.of();
            List<ZabbixMetrics.MetricPoint> memoryHistory = memItemId != null ? fetchItemHistory(memItemId, 0, timeFrom) : List.of();
            List<ZabbixMetrics.MetricPoint> diskHistory = diskItemId != null ? fetchItemHistory(diskItemId, 0, timeFrom) : List.of();
            List<ZabbixMetrics.MetricPoint> netInHistory = net.inItemId() != null ? fetchItemHistory(net.inItemId(), net.valueType(), timeFrom) : List.of();
            List<ZabbixMetrics.MetricPoint> netOutHistory = net.outItemId() != null ? fetchItemHistory(net.outItemId(), net.valueType(), timeFrom) : List.of();
            List<ZabbixMetrics.MetricPoint> temperatureHistory = temp.itemId() != null ? fetchTemperatureHistory(temp.itemId(), timeFrom) : List.of();

            return new ZabbixMetrics(hostId, cpuPercent, memPercent, uptimeSeconds, diskPercent,
                    cpuHistory, memoryHistory, diskHistory, netInHistory, netOutHistory,
                    temp.currentCelsius(), temperatureHistory);
        }, new ZabbixMetrics(hostId, null, null, null, null, List.of(), List.of(), List.of(), List.of(), List.of(), null, List.of()));
    }

    private record NetworkItems(String inItemId, String outItemId, int valueType) {
        static final NetworkItems NONE = new NetworkItems(null, null, 3);
    }

    /**
     * Os itens de interface de rede sao criados por descoberta (LLD) do Zabbix, entao a
     * key exata varia por host/interface (ex. net.if.in["{GUID-DA-INTERFACE}"]) — nao dá
     * pra filtrar por key exata como os outros itens. Busca por prefixo, agrupa in/out pelo
     * trecho entre colchetes (mesma interface) e usa a interface com maior tráfego total
     * combinado, assumindo que é o link físico ativo (não verificado contra Zabbix real —
     * também não confirmado se o item já reporta bytes/s ou um contador bruto acumulado).
     */
    @SuppressWarnings("unchecked")
    private NetworkItems findNetworkItems(String hostId) {
        try {
            Map<String, Object> params = new LinkedHashMap<>();
            params.put("output", List.of("itemid", "key_", "lastvalue", "value_type"));
            params.put("hostids", List.of(hostId));
            params.put("monitored", true);
            params.put("search", Map.of("key_", "net.if."));
            params.put("searchWildcardsEnabled", true);

            List<Map<String, Object>> items = client.call("item.get", params);
            Map<String, Map<String, Object>> inByInterface = new HashMap<>();
            Map<String, Map<String, Object>> outByInterface = new HashMap<>();
            for (Map<String, Object> item : items) {
                String key = str(item, "key_");
                String iface = interfaceFromKey(key);
                if (iface == null) continue;
                if (key.startsWith("net.if.in[")) inByInterface.put(iface, item);
                else if (key.startsWith("net.if.out[")) outByInterface.put(iface, item);
            }

            String bestInterface = null;
            double bestTotal = -1;
            for (Map.Entry<String, Map<String, Object>> entry : inByInterface.entrySet()) {
                Map<String, Object> outItem = outByInterface.get(entry.getKey());
                if (outItem == null) continue;
                double total = parseDouble(str(entry.getValue(), "lastvalue")) + parseDouble(str(outItem, "lastvalue"));
                if (total > bestTotal) {
                    bestTotal = total;
                    bestInterface = entry.getKey();
                }
            }
            if (bestInterface == null) return NetworkItems.NONE;

            Map<String, Object> inItem = inByInterface.get(bestInterface);
            Map<String, Object> outItem = outByInterface.get(bestInterface);
            return new NetworkItems(str(inItem, "itemid"), str(outItem, "itemid"), intVal(inItem, "value_type"));
        } catch (Exception e) {
            log.debug("Falha ao localizar itens de rede do host {}: {}", hostId, e.getMessage());
            return NetworkItems.NONE;
        }
    }

    private record TemperatureItem(String itemId, Double currentCelsius) {
        static final TemperatureItem NONE = new TemperatureItem(null, null);
    }

    @SuppressWarnings("unchecked")
    private TemperatureItem findTemperatureItem(String hostId) {
        try {
            Map<String, Object> params = new LinkedHashMap<>();
            params.put("output", List.of("itemid", "lastvalue"));
            params.put("hostids", List.of(hostId));
            params.put("monitored", true);
            params.put("filter", Map.of("key_", List.of(TEMPERATURE_ITEM_KEY)));

            List<Map<String, Object>> items = client.call("item.get", params);
            if (items.isEmpty()) return TemperatureItem.NONE;

            Map<String, Object> item = items.get(0);
            return new TemperatureItem(str(item, "itemid"), parseTemperatureCelsius(str(item, "lastvalue")));
        } catch (Exception e) {
            log.debug("Falha ao localizar item de temperatura do host {}: {}", hostId, e.getMessage());
            return TemperatureItem.NONE;
        }
    }

    /**
     * O item de temperatura roda uma consulta WMI (MSAcpi_ThermalZoneTemperature) e guarda
     * o resultado como texto — presumivelmente o JSON que o plugin WMI do Zabbix agent2
     * retorna para wmi.getall (lista de linhas, uma por zona térmica). CurrentTemperature
     * vem em décimos de Kelvin (peculiaridade da própria classe ACPI), não em Celsius.
     * Formato NÃO verificado contra um Zabbix real — parsing defensivo, ignora zonas com
     * leitura fora de uma faixa plausível (-20°C a 110°C) e usa a mais quente entre as
     * válidas (a zona mais quente é a mais relevante pra alertar superaquecimento).
     */
    private Double parseTemperatureCelsius(String rawJson) {
        if (rawJson == null || rawJson.isBlank()) return null;
        try {
            JsonNode root = objectMapper.readTree(rawJson);
            Iterable<JsonNode> rows = root.isArray() ? root : List.of(root);
            double best = Double.NaN;
            for (JsonNode row : rows) {
                JsonNode tempNode = row.get("CurrentTemperature");
                if (tempNode == null || !tempNode.isNumber()) continue;
                double celsius = (tempNode.asDouble() / 10.0) - 273.15;
                if (celsius < -20 || celsius > 110) continue;
                if (Double.isNaN(best) || celsius > best) best = celsius;
            }
            return Double.isNaN(best) ? null : best;
        } catch (Exception e) {
            log.debug("Falha ao interpretar leitura de temperatura WMI: {}", e.getMessage());
            return null;
        }
    }

    @SuppressWarnings("unchecked")
    private List<ZabbixMetrics.MetricPoint> fetchTemperatureHistory(String itemId, long timeFrom) {
        try {
            Map<String, Object> histParams = new LinkedHashMap<>();
            histParams.put("itemids", List.of(itemId));
            histParams.put("history", 4); // text
            histParams.put("time_from", timeFrom);
            histParams.put("sortfield", "clock");
            histParams.put("sortorder", "DESC");
            histParams.put("limit", 1000);

            List<Map<String, Object>> hist = client.call("history.get", histParams);
            List<ZabbixMetrics.MetricPoint> points = new ArrayList<>();
            for (Map<String, Object> h : hist) {
                Double celsius = parseTemperatureCelsius(str(h, "value"));
                if (celsius != null) points.add(new ZabbixMetrics.MetricPoint(longVal(h, "clock"), celsius));
            }
            return points.reversed();
        } catch (Exception e) {
            log.debug("History fetch failed for temperature item {}: {}", itemId, e.getMessage());
            return List.of();
        }
    }

    private String interfaceFromKey(String key) {
        int start = key.indexOf('[');
        int end = key.lastIndexOf(']');
        if (start < 0 || end < 0 || end <= start) return null;
        return key.substring(start + 1, end);
    }

    @SuppressWarnings("unchecked")
    private List<ZabbixMetrics.MetricPoint> fetchItemHistory(String itemId, int historyType, long timeFrom) {
        try {
            Map<String, Object> histParams = new LinkedHashMap<>();
            histParams.put("itemids", List.of(itemId));
            histParams.put("history", historyType);
            histParams.put("time_from", timeFrom);
            histParams.put("sortfield", "clock");
            histParams.put("sortorder", "DESC");
            histParams.put("limit", 1000);

            List<Map<String, Object>> hist = client.call("history.get", histParams);
            List<ZabbixMetrics.MetricPoint> points = hist.stream()
                    .map(h -> new ZabbixMetrics.MetricPoint(longVal(h, "clock"), parseDouble(str(h, "value"))))
                    .toList();
            return points.reversed();
        } catch (Exception e) {
            log.debug("History fetch failed for item {}: {}", itemId, e.getMessage());
            return List.of();
        }
    }

    // ── Recent History ────────────────────────────────────────────────────

    @SuppressWarnings("unchecked")
    public List<ZabbixHistoryEntry> getRecentHistory(int hours) {
        return safeCall(() -> {
            long timeFrom = System.currentTimeMillis() / 1000 - (long) hours * 3600;

            Map<String, Object> params = new LinkedHashMap<>();
            params.put("output", List.of("eventid", "objectid", "name", "severity", "clock", "r_clock"));
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

    // ── Problem visibility helpers ───────────────────────────────────────

    @SuppressWarnings("unchecked")
    private boolean isVisibleActiveProblem(Map<String, Object> problem, Map<String, Object> trigger) {
        // If trigger metadata could not be fetched, keep the problem visible rather
        // than hiding a real alert due to a transient Zabbix API shape issue.
        if (trigger == null || trigger.isEmpty()) {
            return true;
        }

        // Disabled trigger: Zabbix UI hides it from Monitoring > Problems.
        if (!"0".equals(str(trigger, "status"))) {
            return false;
        }

        List<Map<String, Object>> hosts = (List<Map<String, Object>>) trigger.get("hosts");
        if (hosts != null && !hosts.isEmpty()) {
            boolean anyDisabledHost = hosts.stream().anyMatch(h -> !"0".equals(str(h, "status")));
            if (anyDisabledHost) {
                return false;
            }
        }

        List<Map<String, Object>> items = (List<Map<String, Object>>) trigger.get("items");
        if (items != null && !items.isEmpty()) {
            boolean allItemsDisabled = items.stream().allMatch(i -> !"0".equals(str(i, "status")));
            if (allItemsDisabled) {
                return false;
            }
        }

        return true;
    }

    @SuppressWarnings("unchecked")
    private String hostNameFromTrigger(Map<String, Object> trigger) {
        if (trigger == null) {
            return "Desconhecido";
        }
        List<Map<String, Object>> hosts = (List<Map<String, Object>>) trigger.get("hosts");
        if (hosts == null || hosts.isEmpty()) {
            return "Desconhecido";
        }
        String name = str(hosts.get(0), "name");
        return name.isBlank() ? "Desconhecido" : name;
    }

    @SuppressWarnings("unchecked")
    private String hostIdFromTrigger(Map<String, Object> trigger) {
        if (trigger == null) return "";
        List<Map<String, Object>> hosts = (List<Map<String, Object>>) trigger.get("hosts");
        if (hosts == null || hosts.isEmpty()) return "";
        return str(hosts.get(0), "hostid");
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
