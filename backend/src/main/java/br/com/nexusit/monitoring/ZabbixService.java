package br.com.nexusit.monitoring;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Service;

import java.io.DataInputStream;
import java.io.DataOutputStream;
import java.net.InetSocketAddress;
import java.net.Socket;
import java.nio.ByteBuffer;
import java.nio.ByteOrder;
import java.nio.charset.StandardCharsets;
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

    private static final String PROCESS_TOP_AGENT_KEY = "proc.get[]";
    private static final int ZABBIX_AGENT_PORT = 10050;

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
            Long memoryTotalBytes = null;
            Long memoryUsedBytes = null;
            Long memoryAvailableBytes = null;
            Double diskPercent = null;
            Long diskTotalBytes = null;
            Long diskUsedBytes = null;
            Long diskFreeBytes = null;
            String diskFilesystem = null;
            Long uptimeSeconds = null;

            Map<String, Object> itemParams = new LinkedHashMap<>();
            itemParams.put("output", List.of("itemid", "key_", "lastvalue", "value_type"));
            itemParams.put("hostids", List.of(hostId));
            itemParams.put("monitored", true);
            itemParams.put("filter", Map.of("key_", List.of(
                    "system.cpu.util", "system.cpu.util[,idle]",
                    "vm.memory.size[pavailable]", "vm.memory.size[pused]", "vm.memory.util",
                    "vm.memory.size[total]", "vm.memory.size[used]", "vm.memory.size[available]",
                    "system.uptime"
            )));

            List<Map<String, Object>> items = new ArrayList<>(client.call("item.get", itemParams));
            items.addAll(findFilesystemPercentItems(hostId));

            String cpuItemId = null;
            boolean cpuHistoryIsIdle = false;
            String memItemId = null;
            String diskItemId = null;
            Map<String, Object> bestDiskItem = null;
            for (Map<String, Object> item : items) {
                String key = str(item, "key_");
                String val = str(item, "lastvalue");
                if (val.isBlank()) continue;
                double dval = parseDouble(val);

                if (key.startsWith("system.cpu.util") && !key.contains("idle")) {
                    cpuPercent = dval;
                    cpuItemId = str(item, "itemid");
                    cpuHistoryIsIdle = false;
                } else if (key.contains("idle")) {
                    cpuPercent = 100.0 - dval;
                    cpuItemId = str(item, "itemid");
                    cpuHistoryIsIdle = true;
                } else if (key.equals("vm.memory.size[pavailable]")) {
                    memPercent = 100.0 - dval;
                    memItemId = str(item, "itemid");
                } else if (key.equals("vm.memory.size[pused]") || key.equals("vm.memory.util")) {
                    memPercent = dval;
                    memItemId = str(item, "itemid");
                } else if (key.equals("vm.memory.size[total]")) {
                    memoryTotalBytes = parseLongBytes(val);
                } else if (key.equals("vm.memory.size[used]")) {
                    memoryUsedBytes = parseLongBytes(val);
                } else if (key.equals("vm.memory.size[available]")) {
                    memoryAvailableBytes = parseLongBytes(val);
                } else if (key.equals("system.uptime")) {
                    uptimeSeconds = (long) dval;
                } else if (isFilesystemUsedPercentKey(key) && preferDiskItem(item, bestDiskItem)) {
                    bestDiskItem = item;
                }
            }

            if (bestDiskItem != null) {
                diskPercent = parseDouble(str(bestDiskItem, "lastvalue"));
                diskItemId = str(bestDiskItem, "itemid");
                diskFilesystem = filesystemFromKey(str(bestDiskItem, "key_"));
                DiskSize diskSize = fetchDiskSize(hostId, str(bestDiskItem, "key_"), diskPercent);
                diskTotalBytes = diskSize.totalBytes();
                diskFreeBytes = diskSize.freeBytes();
                diskUsedBytes = diskSize.usedBytes();
            }

            if (memoryTotalBytes != null) {
                if (memoryUsedBytes == null && memoryAvailableBytes != null) {
                    memoryUsedBytes = Math.max(0, memoryTotalBytes - memoryAvailableBytes);
                }
                if (memoryAvailableBytes == null && memoryUsedBytes != null) {
                    memoryAvailableBytes = Math.max(0, memoryTotalBytes - memoryUsedBytes);
                }
                if (memoryUsedBytes == null && memPercent != null) {
                    memoryUsedBytes = Math.round(memoryTotalBytes * (memPercent / 100.0));
                    memoryAvailableBytes = Math.max(0, memoryTotalBytes - memoryUsedBytes);
                }
            }

            NetworkItems net = findNetworkItems(hostId);
            TemperatureItem temp = findTemperatureItem(hostId);
            ProcessTop processTop = fetchProcessTop(hostId);

            long timeFrom = System.currentTimeMillis() / 1000 - (long) hours * 3600;
            List<ZabbixMetrics.MetricPoint> cpuHistory = cpuItemId != null ? fetchCpuHistory(cpuItemId, cpuHistoryIsIdle, timeFrom) : List.of();
            List<ZabbixMetrics.MetricPoint> memoryHistory = memItemId != null ? fetchItemHistory(memItemId, 0, timeFrom) : List.of();
            List<ZabbixMetrics.MetricPoint> diskHistory = diskItemId != null ? fetchItemHistory(diskItemId, 0, timeFrom) : List.of();
            List<ZabbixMetrics.MetricPoint> netInHistory = net.inItemId() != null ? fetchItemHistory(net.inItemId(), net.valueType(), timeFrom) : List.of();
            List<ZabbixMetrics.MetricPoint> netOutHistory = net.outItemId() != null ? fetchItemHistory(net.outItemId(), net.valueType(), timeFrom) : List.of();
            List<ZabbixMetrics.MetricPoint> temperatureHistory = temp.itemId() != null ? fetchTemperatureHistory(temp.itemId(), timeFrom) : List.of();

            return new ZabbixMetrics(hostId, cpuPercent, memPercent,
                    memoryTotalBytes, memoryUsedBytes, memoryAvailableBytes,
                    uptimeSeconds, diskPercent, diskTotalBytes, diskUsedBytes, diskFreeBytes, diskFilesystem,
                    cpuHistory, memoryHistory, diskHistory, netInHistory, netOutHistory,
                    temp.currentCelsius(), temperatureHistory,
                    processTop.cpu(), processTop.memory());
        }, new ZabbixMetrics(hostId, null, null, null, null, null, null, null, null, null, null, null, List.of(), List.of(), List.of(), List.of(), List.of(), null, List.of(), List.of(), List.of()));
    }

    private record DiskSize(Long totalBytes, Long usedBytes, Long freeBytes) {
        static final DiskSize EMPTY = new DiskSize(null, null, null);
    }

    @SuppressWarnings("unchecked")
    private DiskSize fetchDiskSize(String hostId, String usedPercentKey, Double usedPercent) {
        String fs = filesystemFromKey(usedPercentKey);
        if (fs == null) return DiskSize.EMPTY;
        String prefix = usedPercentKey.startsWith("vfs.fs.dependent.size[") ? "vfs.fs.dependent.size" : "vfs.fs.size";
        String totalKey = prefix + "[" + fs + ",total]";
        String freeKey = prefix + "[" + fs + ",free]";
        String usedKey = prefix + "[" + fs + ",used]";
        try {
            Map<String, Object> params = new LinkedHashMap<>();
            params.put("output", List.of("itemid", "key_", "lastvalue"));
            params.put("hostids", List.of(hostId));
            params.put("monitored", true);
            params.put("filter", Map.of("key_", List.of(totalKey, freeKey, usedKey)));
            List<Map<String, Object>> items = client.call("item.get", params);
            Long total = null;
            Long free = null;
            Long used = null;
            for (Map<String, Object> item : items) {
                String key = str(item, "key_");
                if (key.equals(totalKey)) total = parseLongBytes(str(item, "lastvalue"));
                else if (key.equals(freeKey)) free = parseLongBytes(str(item, "lastvalue"));
                else if (key.equals(usedKey)) used = parseLongBytes(str(item, "lastvalue"));
            }
            if (total == null && free != null && usedPercent != null && usedPercent < 100.0) {
                total = Math.round(free / (1.0 - (usedPercent / 100.0)));
            }
            if (used == null && total != null && free != null) used = Math.max(0, total - free);
            if (free == null && total != null && used != null) free = Math.max(0, total - used);
            if (used == null && total != null && usedPercent != null) used = Math.round(total * (usedPercent / 100.0));
            if (free == null && total != null && used != null) free = Math.max(0, total - used);
            return new DiskSize(total, used, free);
        } catch (Exception e) {
            log.debug("Falha ao localizar totais de disco do host {} fs {}: {}", hostId, fs, e.getMessage());
            return DiskSize.EMPTY;
        }
    }

    @SuppressWarnings("unchecked")
    private List<Map<String, Object>> findFilesystemPercentItems(String hostId) {
        try {
            Map<String, Object> params = new LinkedHashMap<>();
            params.put("output", List.of("itemid", "key_", "lastvalue", "value_type"));
            params.put("hostids", List.of(hostId));
            params.put("monitored", true);
            // Zabbix wildcard matching does not reliably match patterns with brackets
            // such as "*[,pused]". Search broadly and filter exact filesystem used-%
            // keys in Java so both vfs.fs.size[...] and vfs.fs.dependent.size[...]
            // are accepted.
            params.put("search", Map.of("key_", "vfs.fs."));
            List<Map<String, Object>> items = client.call("item.get", params);
            return items.stream()
                    .filter(item -> isFilesystemUsedPercentKey(str(item, "key_")))
                    .toList();
        } catch (Exception e) {
            log.debug("Falha ao localizar itens de disco do host {}: {}", hostId, e.getMessage());
            return List.of();
        }
    }

    private boolean isFilesystemUsedPercentKey(String key) {
        return (key.startsWith("vfs.fs.size[") || key.startsWith("vfs.fs.dependent.size["))
                && key.endsWith(",pused]");
    }

    private boolean preferDiskItem(Map<String, Object> candidate, Map<String, Object> current) {
        if (current == null) return true;
        String candFs = filesystemFromKey(str(candidate, "key_"));
        String currFs = filesystemFromKey(str(current, "key_"));
        int candScore = filesystemPriority(candFs);
        int currScore = filesystemPriority(currFs);
        if (candScore != currScore) return candScore > currScore;
        return parseDouble(str(candidate, "lastvalue")) > parseDouble(str(current, "lastvalue"));
    }

    private int filesystemPriority(String fs) {
        if (fs == null) return 0;
        if (fs.equalsIgnoreCase("C:")) return 100;
        if (fs.equals("/")) return 90;
        if (fs.equalsIgnoreCase("D:")) return 80;
        if (fs.equals("/boot")) return 10;
        return 50;
    }

    private String filesystemFromKey(String key) {
        int start = key.indexOf('[');
        int comma = key.lastIndexOf(",pused]");
        if (start < 0 || comma <= start) return null;
        return key.substring(start + 1, comma);
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
            // With searchWildcardsEnabled=true, Zabbix expects an explicit wildcard.
            // Searching for "net.if." returns zero items on Zabbix 6.x, while
            // "net.if.*" matches discovered interface metrics such as
            // net.if.in[...] and net.if.out[...].
            params.put("search", Map.of("key_", "net.if.*"));
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

    private List<ZabbixMetrics.MetricPoint> fetchCpuHistory(String itemId, boolean idleItem, long timeFrom) {
        List<ZabbixMetrics.MetricPoint> points = fetchItemHistory(itemId, 0, timeFrom);
        if (!idleItem) return points;
        return points.stream()
                .map(p -> new ZabbixMetrics.MetricPoint(p.timestamp(), Math.max(0.0, Math.min(100.0, 100.0 - p.value()))))
                .toList();
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

    private record ProcessTop(
            List<ZabbixMetrics.ProcessTopEntry> cpu,
            List<ZabbixMetrics.ProcessTopEntry> memory
    ) {
        static final ProcessTop EMPTY = new ProcessTop(List.of(), List.of());
    }

    private record ProcessSnapshot(
            long pid,
            String name,
            double cpuTimeSeconds,
            double memoryPercent,
            long rssBytes
    ) {}

    private ProcessTop fetchProcessTop(String hostId) {
        try {
            String ip = fetchHostMainIp(hostId);
            if (ip.isBlank()) return ProcessTop.EMPTY;

            List<ProcessSnapshot> first = fetchAgentProcesses(ip);
            if (first.isEmpty()) return ProcessTop.EMPTY;
            try {
                Thread.sleep(800);
            } catch (InterruptedException e) {
                Thread.currentThread().interrupt();
                return ProcessTop.EMPTY;
            }
            List<ProcessSnapshot> second = fetchAgentProcesses(ip);
            if (second.isEmpty()) return ProcessTop.EMPTY;

            return buildProcessTop(first, second, 0.8);
        } catch (Exception e) {
            log.debug("Falha ao consultar top processos do host {}: {}", hostId, e.getMessage());
            return ProcessTop.EMPTY;
        }
    }

    @SuppressWarnings("unchecked")
    private String fetchHostMainIp(String hostId) {
        Map<String, Object> params = new LinkedHashMap<>();
        params.put("output", List.of("hostid"));
        params.put("hostids", List.of(hostId));
        params.put("selectInterfaces", List.of("ip", "main"));
        List<Map<String, Object>> hosts = client.call("host.get", params);
        if (hosts.isEmpty()) return "";
        List<Map<String, Object>> ifaces = (List<Map<String, Object>>) hosts.get(0).get("interfaces");
        if (ifaces == null || ifaces.isEmpty()) return "";
        String mainIp = ifaces.stream()
                .filter(i -> "1".equals(str(i, "main")))
                .findFirst()
                .map(i -> str(i, "ip"))
                .orElse(str(ifaces.get(0), "ip"));
        // Quando o host monitorado é o próprio SRV-INTERNO, consultar pelo IP LAN
        // a partir do container pode sair por uma bridge não autorizada no Agent.
        // O gateway Docker 172.18.0.1 é o próprio host e já está permitido no agent2.
        if ("192.168.2.210".equals(mainIp)) return "172.18.0.1";
        return mainIp;
    }

    private List<ProcessSnapshot> fetchAgentProcesses(String ip) throws Exception {
        String payload = zabbixAgentGet(ip, PROCESS_TOP_AGENT_KEY);
        if (payload == null || payload.isBlank() || payload.startsWith("ZBX_NOTSUPPORTED")) return List.of();
        JsonNode root = objectMapper.readTree(payload);
        if (!root.isArray()) return List.of();
        List<ProcessSnapshot> result = new ArrayList<>();
        for (JsonNode row : root) {
            if (row == null || !row.isObject()) continue;
            long pid = row.path("pid").asLong(-1L);
            String name = safeProcessName(row.path("name").asText(""));
            if (pid < 0 || name.isBlank()) continue;
            double cpuTime = row.path("cputime_user").asDouble(0.0) + row.path("cputime_system").asDouble(0.0);
            long rssBytes = processRssBytes(row);
            double memPercent = row.path("pmem").asDouble(0.0);
            result.add(new ProcessSnapshot(pid, name, Math.max(0.0, cpuTime), Math.max(0.0, memPercent), Math.max(0L, rssBytes)));
        }
        return result;
    }

    private String zabbixAgentGet(String ip, String key) throws Exception {
        byte[] keyBytes = key.getBytes(StandardCharsets.UTF_8);
        try (Socket socket = new Socket()) {
            socket.connect(new InetSocketAddress(ip, ZABBIX_AGENT_PORT), 2500);
            socket.setSoTimeout(5000);
            DataOutputStream out = new DataOutputStream(socket.getOutputStream());
            out.write("ZBXD\1".getBytes(StandardCharsets.US_ASCII));
            out.write(ByteBuffer.allocate(8).order(ByteOrder.LITTLE_ENDIAN).putLong(keyBytes.length).array());
            out.write(keyBytes);
            out.flush();

            DataInputStream in = new DataInputStream(socket.getInputStream());
            byte[] header = in.readNBytes(5);
            if (header.length == 5 && new String(header, StandardCharsets.US_ASCII).equals("ZBXD\1")) {
                byte[] lenBytes = in.readNBytes(8);
                long len = ByteBuffer.wrap(lenBytes).order(ByteOrder.LITTLE_ENDIAN).getLong();
                if (len <= 0 || len > 2_000_000) return "";
                return new String(in.readNBytes((int) len), StandardCharsets.UTF_8);
            }
            byte[] rest = in.readAllBytes();
            byte[] combined = new byte[header.length + rest.length];
            System.arraycopy(header, 0, combined, 0, header.length);
            System.arraycopy(rest, 0, combined, header.length, rest.length);
            return new String(combined, StandardCharsets.UTF_8);
        }
    }

    private long processRssBytes(JsonNode row) {
        if (row.has("rss") && row.path("rss").asLong(-1L) >= 0) return row.path("rss").asLong();
        if (row.has("wkset") && row.path("wkset").asLong(-1L) >= 0) return row.path("wkset").asLong() * 1024L;
        if (row.has("pss") && row.path("pss").asLong(-1L) >= 0) return row.path("pss").asLong();
        return 0L;
    }

    private ProcessTop buildProcessTop(List<ProcessSnapshot> first, List<ProcessSnapshot> second, double intervalSeconds) {
        Map<Long, ProcessSnapshot> beforeByPid = new HashMap<>();
        for (ProcessSnapshot p : first) beforeByPid.put(p.pid(), p);

        Map<String, MutableProcessTop> cpuAgg = new HashMap<>();
        Map<String, MutableProcessTop> memAgg = new HashMap<>();
        for (ProcessSnapshot current : second) {
            double cpuPercent = 0.0;
            ProcessSnapshot before = beforeByPid.get(current.pid());
            if (before != null) {
                cpuPercent = Math.max(0.0, ((current.cpuTimeSeconds() - before.cpuTimeSeconds()) / intervalSeconds) * 100.0);
            }
            accumulateProcess(cpuAgg, current, cpuPercent);
            accumulateProcess(memAgg, current, cpuPercent);
        }
        return new ProcessTop(toProcessEntries(cpuAgg.values(), Comparator.comparingDouble(MutableProcessTop::cpuPercent).reversed()),
                toProcessEntries(memAgg.values(), Comparator.comparingLong(MutableProcessTop::rssBytes).reversed()));
    }

    private static class MutableProcessTop {
        final String name;
        final List<Long> pids = new ArrayList<>();
        int count;
        double cpuPercent;
        double memoryPercent;
        long rssBytes;
        MutableProcessTop(String name) { this.name = name; }
        double cpuPercent() { return cpuPercent; }
        long rssBytes() { return rssBytes; }
    }

    private void accumulateProcess(Map<String, MutableProcessTop> agg, ProcessSnapshot snapshot, double cpuPercent) {
        MutableProcessTop row = agg.computeIfAbsent(snapshot.name(), MutableProcessTop::new);
        row.count++;
        if (row.pids.size() < 5) row.pids.add(snapshot.pid());
        row.cpuPercent += cpuPercent;
        row.memoryPercent += snapshot.memoryPercent();
        row.rssBytes += snapshot.rssBytes();
    }

    private List<ZabbixMetrics.ProcessTopEntry> toProcessEntries(Collection<MutableProcessTop> rows, Comparator<MutableProcessTop> comparator) {
        return rows.stream()
                .sorted(comparator)
                .limit(8)
                .map(row -> new ZabbixMetrics.ProcessTopEntry(
                        row.name,
                        row.pids,
                        Math.max(1, row.count),
                        Math.round(row.cpuPercent * 10.0) / 10.0,
                        Math.round(row.memoryPercent * 10.0) / 10.0,
                        Math.max(0L, row.rssBytes)
                ))
                .toList();
    }

    private String safeProcessName(String raw) {
        if (raw == null) return "";
        String cleaned = raw.replaceAll("[\\p{Cntrl}]", "").trim();
        if (cleaned.length() > 80) cleaned = cleaned.substring(0, 80);
        return cleaned;
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

    private Long parseLongBytes(String val) {
        if (val == null || val.isBlank()) return null;
        try { return Math.round(Double.parseDouble(val)); }
        catch (NumberFormatException e) { return null; }
    }
}
