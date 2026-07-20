package br.com.nexusit.broadcast;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;

import java.util.UUID;

public record RuleRequest(
        @NotBlank String name,
        @NotBlank String hostId,
        String hostName,
        @NotBlank String message,
        @NotNull TargetType targetType,
        @NotNull UUID targetId,
        @NotNull RuleMode mode,
        Integer cooldownMinutes
) {}
