package br.com.nexusit.monitoring;

import java.util.List;

public record ZabbixMetrics(
        String hostId,
        Double cpuPercent,
        Double memoryUsedPercent,
        Long memoryTotalBytes,
        Long memoryUsedBytes,
        Long memoryAvailableBytes,
        Long uptimeSeconds,
        Double diskUsedPercent,
        Long diskTotalBytes,
        Long diskUsedBytes,
        Long diskFreeBytes,
        String diskFilesystem,
        List<MetricPoint> cpuHistory,
        List<MetricPoint> memoryHistory,
        List<MetricPoint> diskHistory,
        List<MetricPoint> networkInHistory,
        List<MetricPoint> networkOutHistory,
        Double temperatureCelsius,
        List<MetricPoint> temperatureHistory
) {
    public record MetricPoint(long timestamp, double value) {}
}
