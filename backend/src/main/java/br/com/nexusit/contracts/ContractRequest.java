package br.com.nexusit.contracts;

import java.math.BigDecimal;
import java.time.LocalDate;

public record ContractRequest(
        String name, String vendor, String contactName, String contactEmail,
        String contactPhone, String type, BigDecimal value,
        LocalDate startDate, LocalDate endDate, boolean autoRenew, String notes
) {}
