package br.com.nexusit.vault;

import jakarta.validation.constraints.NotBlank;

public record CredentialRequest(
        @NotBlank String title,
        String type,
        String username,
        @NotBlank String secret,
        String url,
        String description,
        String tags
) {}
