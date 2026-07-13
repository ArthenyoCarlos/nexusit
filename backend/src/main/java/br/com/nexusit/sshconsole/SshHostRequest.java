package br.com.nexusit.sshconsole;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;

import java.util.UUID;

public record SshHostRequest(
        @NotBlank String name,
        @NotBlank String host,
        @NotNull Integer port,
        @NotBlank String username,
        String authType,
        String password,
        String privateKey,
        String privateKeyPassphrase,
        String description,
        UUID inventoryItemId
) {}
