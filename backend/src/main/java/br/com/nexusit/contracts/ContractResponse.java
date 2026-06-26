package br.com.nexusit.contracts;

import java.math.BigDecimal;
import java.time.LocalDate;
import java.time.LocalDateTime;
import java.time.temporal.ChronoUnit;
import java.util.UUID;

public record ContractResponse(
        UUID id, String name, String vendor, String contactName, String contactEmail,
        String contactPhone, String type, BigDecimal value,
        LocalDate startDate, LocalDate endDate, boolean autoRenew,
        String notes, String status, long daysUntilExpiry, LocalDateTime createdAt
) {
    public static ContractResponse from(Contract c) {
        long days = Long.MAX_VALUE;
        String status = "OK";
        if (c.getEndDate() != null) {
            days = ChronoUnit.DAYS.between(LocalDate.now(), c.getEndDate());
            if (days < 0)        status = "EXPIRED";
            else if (days <= 30) status = "EXPIRING_SOON";
            else if (days <= 90) status = "EXPIRING";
        }
        return new ContractResponse(
                c.getId(), c.getName(), c.getVendor(), c.getContactName(),
                c.getContactEmail(), c.getContactPhone(), c.getType(), c.getValue(),
                c.getStartDate(), c.getEndDate(), c.isAutoRenew(), c.getNotes(),
                status, days == Long.MAX_VALUE ? -1 : days, c.getCreatedAt()
        );
    }
}
