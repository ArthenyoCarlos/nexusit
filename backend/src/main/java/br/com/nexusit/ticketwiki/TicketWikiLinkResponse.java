package br.com.nexusit.ticketwiki;

import java.time.LocalDateTime;
import java.util.UUID;

public record TicketWikiLinkResponse(
        UUID id,
        Long glpiTicketId,
        UUID wikiArticleId,
        String wikiTitle,
        String wikiCategory,
        String createdByName,
        LocalDateTime createdAt
) {
    public static TicketWikiLinkResponse from(TicketWikiLink link) {
        var article = link.getWikiArticle();
        var user = link.getCreatedBy();
        return new TicketWikiLinkResponse(
                link.getId(),
                link.getGlpiTicketId(),
                article.getId(),
                article.getTitle(),
                article.getCategory(),
                user != null ? user.getName() : null,
                link.getCreatedAt()
        );
    }
}
