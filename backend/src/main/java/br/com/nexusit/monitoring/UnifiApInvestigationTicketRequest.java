package br.com.nexusit.monitoring;

public record UnifiApInvestigationTicketRequest(
        String apName,
        String reason
) {}
