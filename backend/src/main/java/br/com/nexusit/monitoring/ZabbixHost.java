package br.com.nexusit.monitoring;

public record ZabbixHost(
        String id,
        String name,
        String ip,
        boolean monitored,
        boolean available,
        Long uptimeSeconds
) {}
