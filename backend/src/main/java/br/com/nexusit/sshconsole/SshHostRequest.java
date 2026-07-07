package br.com.nexusit.sshconsole;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;

import java.util.UUID;

public record SshHostRequest(
        @NotBlank String name,
        @NotBlank String host,
        @NotNull Integer port,
        @NotBlank String username,
        String password,
        String description,
        UUID inventoryItemId
) {}
