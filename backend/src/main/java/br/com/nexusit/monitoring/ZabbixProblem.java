package br.com.nexusit.monitoring;

public record ZabbixProblem(
        String id,
        String name,
        int severity,
        String severityLabel,
        String hostName,
        long clock
) {}
