package br.com.nexusit.monitoring;

import java.util.List;

public record ZabbixMetrics(
        String hostId,
        Double cpuPercent,
        Double memoryUsedPercent,
        Long uptimeSeconds,
        Double diskUsedPercent,
        List<MetricPoint> cpuHistory,
        List<MetricPoint> memoryHistory,
        List<MetricPoint> diskHistory,
        List<MetricPoint> networkInHistory,
        List<MetricPoint> networkOutHistory
) {
    public record MetricPoint(long timestamp, double value) {}
}
