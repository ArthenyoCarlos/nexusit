package br.com.nexusit.networkdoc;

import jakarta.validation.constraints.NotBlank;

public record NetworkDocRequest(
        @NotBlank String title,
        @NotBlank String section,
        String content
) {}
