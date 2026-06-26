package br.com.nexusit.licenses;

import jakarta.validation.constraints.NotBlank;

import java.math.BigDecimal;
import java.time.LocalDate;

public record LicenseRequest(
        @NotBlank String name,
        String vendor,
        String product,
        String licenseKey,
        Integer seatsTotal,
        Integer seatsUsed,
        LocalDate purchaseDate,
        LocalDate expiryDate,
        BigDecimal value,
        String notes
) {}
