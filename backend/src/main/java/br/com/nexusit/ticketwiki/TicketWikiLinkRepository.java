package br.com.nexusit.ticketwiki;

import org.springframework.data.jpa.repository.JpaRepository;

import java.util.List;
import java.util.Optional;
import java.util.UUID;

public interface TicketWikiLinkRepository extends JpaRepository<TicketWikiLink, UUID> {
    List<TicketWikiLink> findByGlpiTicketIdOrderByCreatedAtDesc(Long glpiTicketId);
    Optional<TicketWikiLink> findByGlpiTicketIdAndWikiArticleId(Long glpiTicketId, UUID wikiArticleId);
}
