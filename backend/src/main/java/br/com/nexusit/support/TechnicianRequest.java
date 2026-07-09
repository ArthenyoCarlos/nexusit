package br.com.nexusit.support;

import jakarta.validation.constraints.NotNull;

import java.util.UUID;

public record TechnicianRequest(@NotNull UUID userId) {}
