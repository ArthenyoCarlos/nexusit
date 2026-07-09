package br.com.nexusit.nexusdesk;

import jakarta.validation.constraints.NotBlank;

import java.util.UUID;

public record NexusDeskDeviceRequest(
        @NotBlank String name,
        @NotBlank String rustdeskId,
        String password,
        String notes,
        UUID inventoryItemId
) {}
