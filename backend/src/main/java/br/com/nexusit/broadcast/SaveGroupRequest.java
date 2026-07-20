package br.com.nexusit.broadcast;

import jakarta.validation.constraints.NotBlank;

public record SaveGroupRequest(
        @NotBlank String name,
        @NotBlank String groupJid
) {}
