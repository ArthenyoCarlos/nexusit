package br.com.nexusit.ticketwiki;

import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

import java.util.List;
import java.util.Optional;
import java.util.UUID;

public interface TicketWikiLinkRepository extends JpaRepository<TicketWikiLink, UUID> {
    List<TicketWikiLink> findByGlpiTicketIdOrderByCreatedAtDesc(Long glpiTicketId);
    Optional<TicketWikiLink> findByGlpiTicketIdAndWikiArticleId(Long glpiTicketId, UUID wikiArticleId);

    long countByWikiArticleId(UUID wikiArticleId);

    interface WikiArticleLinkCount {
        UUID getWikiArticleId();
        Long getLinkedTicketCount();
    }

    @Query("""
            select l.wikiArticle.id as wikiArticleId, count(l.id) as linkedTicketCount
            from TicketWikiLink l
            where l.wikiArticle.id in :ids
            group by l.wikiArticle.id
            """)
    List<WikiArticleLinkCount> countByWikiArticleIds(@Param("ids") List<UUID> ids);
}
