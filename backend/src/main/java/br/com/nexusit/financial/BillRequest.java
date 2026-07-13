package br.com.nexusit.financial;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Positive;

import java.math.BigDecimal;
import java.time.LocalDate;

public record BillRequest(
        @NotBlank(message = "título é obrigatório") String title,
        String vendor,
        String category,
        @NotNull(message = "valor é obrigatório") @Positive(message = "valor precisa ser maior que zero") BigDecimal amount,
        @NotNull(message = "data de vencimento é obrigatória") LocalDate dueDate,
        String notes
) {}
