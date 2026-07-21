package br.com.nexusit.cartridge;

import jakarta.validation.constraints.NotBlank;

public record CartridgeCreateRequest(
        @NotBlank String model,
        String printerModel,
        String initialSector
) {}
