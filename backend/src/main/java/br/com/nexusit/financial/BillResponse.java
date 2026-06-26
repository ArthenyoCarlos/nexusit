package br.com.nexusit.financial;

import java.math.BigDecimal;
import java.time.LocalDate;
import java.time.LocalDateTime;
import java.time.temporal.ChronoUnit;
import java.util.UUID;

public record BillResponse(
        UUID id, String title, String vendor, String category,
        BigDecimal amount, LocalDate dueDate, boolean paid, LocalDate paidAt,
        String notes, String status, long daysUntilDue, LocalDateTime createdAt
) {
    public static BillResponse from(Bill b) {
        long days = ChronoUnit.DAYS.between(LocalDate.now(), b.getDueDate());
        String status;
        if (b.isPaid())      status = "PAID";
        else if (days < 0)   status = "OVERDUE";
        else if (days <= 3)  status = "DUE_SOON";
        else if (days <= 7)  status = "UPCOMING";
        else                 status = "OK";
        return new BillResponse(b.getId(), b.getTitle(), b.getVendor(), b.getCategory(),
                b.getAmount(), b.getDueDate(), b.isPaid(), b.getPaidAt(),
                b.getNotes(), status, days, b.getCreatedAt());
    }
}
