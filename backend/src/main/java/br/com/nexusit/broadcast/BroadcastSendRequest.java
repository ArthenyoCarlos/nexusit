package br.com.nexusit.broadcast;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;

import java.util.UUID;

public record BroadcastSendRequest(
        @NotNull TargetType targetType,
        @NotNull UUID targetId,
        @NotBlank String message
) {}
