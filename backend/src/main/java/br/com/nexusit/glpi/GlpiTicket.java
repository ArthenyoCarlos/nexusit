package br.com.nexusit.glpi;

public record GlpiTicket(
        int id,
        String title,
        int status,
        String statusLabel,
        int priority,
        String priorityLabel,
        String requester,
        String assignedTo,
        String openedAt,
        String solvedAt,
        int ticketType,
        String slaTtoName,
        String slaTtrName,
        String timeToOwn,
        String timeToResolve,
        int slaWaitingDuration
) {}
