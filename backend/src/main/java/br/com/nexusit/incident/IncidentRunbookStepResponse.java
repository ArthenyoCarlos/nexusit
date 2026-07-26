package br.com.nexusit.incident;

public record IncidentRunbookStepResponse(
        String actionKey,
        String title,
        String description,
        String safetyLevel,
        String expectedOutput,
        boolean executable
) {}
