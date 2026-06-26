package br.com.nexusit.licenses;

import java.math.BigDecimal;
import java.time.LocalDate;
import java.time.LocalDateTime;
import java.time.temporal.ChronoUnit;
import java.util.UUID;

public record LicenseResponse(
        UUID id,
        String name,
        String vendor,
        String product,
        Integer seatsTotal,
        Integer seatsUsed,
        LocalDate purchaseDate,
        LocalDate expiryDate,
        BigDecimal value,
        String notes,
        String status,
        long daysUntilExpiry,
        LocalDateTime createdAt
) {
    public static LicenseResponse from(License l) {
        long days = Long.MAX_VALUE;
        String status = "OK";
        if (l.getExpiryDate() != null) {
            days = ChronoUnit.DAYS.between(LocalDate.now(), l.getExpiryDate());
            if (days < 0)        status = "EXPIRED";
            else if (days <= 30) status = "EXPIRING_SOON";
            else if (days <= 90) status = "EXPIRING";
        }
        return new LicenseResponse(
                l.getId(), l.getName(), l.getVendor(), l.getProduct(),
                l.getSeatsTotal(), l.getSeatsUsed(),
                l.getPurchaseDate(), l.getExpiryDate(), l.getValue(),
                l.getNotes(), status, days == Long.MAX_VALUE ? -1 : days,
                l.getCreatedAt()
        );
    }
}
