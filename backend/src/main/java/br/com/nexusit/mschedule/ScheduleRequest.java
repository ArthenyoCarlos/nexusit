package br.com.nexusit.mschedule;

import java.time.LocalDate;
import java.util.UUID;

public record ScheduleRequest(String title, String description, String recurrence, LocalDate nextDue, UUID assignedToId) {}
