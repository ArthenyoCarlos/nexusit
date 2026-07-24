package br.com.nexusit.alerttriage;

import java.time.LocalDateTime;
import java.util.UUID;

public record AlertTriageRuleResponse(
        UUID id,
        String hostPattern,
        String alertPattern,
        Integer severityMin,
        Integer severityMax,
        AlertTriageAction action,
        String actionLabel,
        String reason,
        LocalDateTime silencedUntil,
        boolean enabled,
        String createdBy,
        LocalDateTime createdAt,
        LocalDateTime updatedAt
) {
    public static AlertTriageRuleResponse from(AlertTriageRule r) {
        return new AlertTriageRuleResponse(
                r.getId(), r.getHostPattern(), r.getAlertPattern(), r.getSeverityMin(), r.getSeverityMax(),
                r.getAction(), label(r.getAction()), r.getReason(), r.getSilencedUntil(), r.isEnabled(),
                r.getCreatedBy() != null ? r.getCreatedBy().getName() : null,
                r.getCreatedAt(), r.getUpdatedAt());
    }

    public static String label(AlertTriageAction action) {
        if (action == null) return "Sem regra";
        return switch (action) {
            case SHOW_ONLY -> "Mostrar na triagem";
            case CREATE_TICKET_IMMEDIATELY -> "Criar chamado imediatamente";
            case CREATE_TICKET_AFTER_DELAY -> "Criar chamado após persistência";
            case CREATE_TICKET_ON_RECURRENCE -> "Criar chamado por recorrência";
            case IGNORE -> "Descartado";
            case SILENCE_TEMPORARILY -> "Silenciado temporariamente";
        };
    }
}
