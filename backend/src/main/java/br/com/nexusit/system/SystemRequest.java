package br.com.nexusit.system;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;

import java.util.UUID;

public record SystemRequest(
        @NotBlank String name,
        String url,
        String description,
        @NotNull SystemCategory category,
        UUID serverId,
        UUID responsibleId,
        SystemStatus status,
        String documentation
) {}
