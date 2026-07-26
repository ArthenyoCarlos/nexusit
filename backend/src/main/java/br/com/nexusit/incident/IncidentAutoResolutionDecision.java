package br.com.nexusit.incident;

public record IncidentAutoResolutionDecision(
        String status,
        String reason,
        int minutesStable,
        boolean activeSourcePresent
) {}
