package br.com.nexusit.alerttriage;

import java.time.LocalDateTime;
import java.util.UUID;

public record AlertTriageItem(
        String eventId,
        String hostName,
        String alertName,
        int severity,
        String severityLabel,
        long clock,
        long ageSeconds,
        String status,
        AlertTriageAction action,
        String actionLabel,
        UUID ruleId,
        String ruleReason,
        LocalDateTime silencedUntil,
        boolean ticketEligible,
        String recommendation
) {}
