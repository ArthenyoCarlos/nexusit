package br.com.nexusit.contracts;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.PositiveOrZero;

import java.math.BigDecimal;
import java.time.LocalDate;

public record ContractRequest(
        @NotBlank(message = "nome é obrigatório") String name,
        String vendor, String contactName, String contactEmail,
        String contactPhone, String type,
        @PositiveOrZero(message = "valor não pode ser negativo") BigDecimal value,
        LocalDate startDate, LocalDate endDate, boolean autoRenew, String notes
) {}
