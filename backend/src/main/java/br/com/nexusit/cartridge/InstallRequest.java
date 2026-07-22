package br.com.nexusit.cartridge;

import jakarta.validation.constraints.NotBlank;

public record InstallRequest(@NotBlank String sector) {}
