package br.com.nexusit.inventory;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;

import java.math.BigDecimal;
import java.time.LocalDate;
import java.util.UUID;

public record InventoryRequest(
        @NotBlank String name,
        @NotNull ItemType type,
        String brand,
        String model,
        String serialNumber,
        String location,
        UUID responsibleId,
        LocalDate purchaseDate,
        ItemStatus status,
        String notes,
        LocalDate warrantyUntil,
        BigDecimal value
) {}
