package br.com.nexusit.wiki;

import jakarta.validation.constraints.NotBlank;

public record WikiRequest(
        @NotBlank(message = "título é obrigatório") String title,
        String category,
        String content,
        String tags
) {}
