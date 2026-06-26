package br.com.nexusit.maintenance;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;

import java.math.BigDecimal;
import java.time.LocalDate;
import java.util.UUID;

public record MaintenanceRequest(
        @NotBlank String title,
        String description,
        @NotNull LocalDate performedAt,
        BigDecimal cost,
        UUID performedById
) {}
