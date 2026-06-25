package br.com.nexusit.glpi;

import java.util.List;

public record GlpiTicketDetail(
        GlpiTicket ticket,
        String content,
        List<GlpiFollowup> followups
) {}
