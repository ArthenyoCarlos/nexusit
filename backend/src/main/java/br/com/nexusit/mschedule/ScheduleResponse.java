package br.com.nexusit.mschedule;

import java.time.LocalDate;
import java.time.LocalDateTime;
import java.time.temporal.ChronoUnit;
import java.util.UUID;

public record ScheduleResponse(
        UUID id, String title, String description, String recurrence,
        LocalDate nextDue, long daysUntilDue, String dueSatus,
        String assignedToName, boolean active, LocalDateTime createdAt
) {
    public static ScheduleResponse from(MaintenanceSchedule s) {
        long days = s.getNextDue() != null ? ChronoUnit.DAYS.between(LocalDate.now(), s.getNextDue()) : 999;
        String status = days < 0 ? "OVERDUE" : days == 0 ? "TODAY" : days <= 7 ? "SOON" : "OK";
        return new ScheduleResponse(s.getId(), s.getTitle(), s.getDescription(), s.getRecurrence(),
                s.getNextDue(), days, status,
                s.getAssignedTo() != null ? s.getAssignedTo().getName() : null,
                s.isActive(), s.getCreatedAt());
    }
}
