package br.com.nexusit.monitoring;

import java.util.List;

public record ZabbixMetrics(
        String hostId,
        Double cpuPercent,
        Double memoryUsedPercent,
        Long uptimeSeconds,
        List<CpuDataPoint> cpuHistory,
        List<CpuDataPoint> memoryHistory
) {
    public record CpuDataPoint(long timestamp, double value) {}
}
