package br.com.nexusit.alerttriage;

import java.time.LocalDateTime;

public record AlertTriageDecisionRequest(
        String eventId,
        AlertTriageAction action,
        String reason,
        LocalDateTime silencedUntil,
        Integer minDurationMinutes,
        Integer recurrenceWindowMinutes,
        Integer recurrenceCountThreshold
) {}
