package br.com.nexusit.monitoring;

public record ZabbixHistoryEntry(
        String id,
        String name,
        int severity,
        String severityLabel,
        String hostName,
        long clock,
        Long resolvedAt
) {}
