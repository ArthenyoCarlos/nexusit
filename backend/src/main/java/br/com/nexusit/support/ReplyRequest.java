package br.com.nexusit.support;

import jakarta.validation.constraints.NotBlank;

public record ReplyRequest(@NotBlank String message) {}
