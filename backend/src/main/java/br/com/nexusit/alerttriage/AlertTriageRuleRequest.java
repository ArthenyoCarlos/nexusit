package br.com.nexusit.alerttriage;

import java.time.LocalDateTime;

public record AlertTriageRuleRequest(
        String hostPattern,
        String alertPattern,
        Integer severityMin,
        Integer severityMax,
        AlertTriageAction action,
        String reason,
        LocalDateTime silencedUntil,
        Boolean enabled
) {}
