package br.com.nexusit.ticketwiki;

import java.util.UUID;

public record TicketWikiLinkRequest(Long glpiTicketId, UUID wikiArticleId) {}
