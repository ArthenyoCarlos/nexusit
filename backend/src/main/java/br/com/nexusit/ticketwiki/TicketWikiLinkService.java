package br.com.nexusit.ticketwiki;

import br.com.nexusit.user.User;
import br.com.nexusit.wiki.WikiRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;

import java.util.List;
import java.util.UUID;

@Service @RequiredArgsConstructor
public class TicketWikiLinkService {
    private final TicketWikiLinkRepository repo;
    private final WikiRepository wikiRepo;

    public TicketWikiLinkResponse create(TicketWikiLinkRequest req, User user) {
        if (req.glpiTicketId() == null || req.glpiTicketId() <= 0)
            throw new IllegalArgumentException("glpiTicketId inválido");
        if (req.wikiArticleId() == null)
            throw new IllegalArgumentException("wikiArticleId obrigatório");

        var existing = repo.findByGlpiTicketIdAndWikiArticleId(req.glpiTicketId(), req.wikiArticleId());
        if (existing.isPresent()) return TicketWikiLinkResponse.from(existing.get());

        var article = wikiRepo.findById(req.wikiArticleId()).orElseThrow();
        var link = TicketWikiLink.builder()
                .glpiTicketId(req.glpiTicketId())
                .wikiArticle(article)
                .createdBy(user)
                .build();
        return TicketWikiLinkResponse.from(repo.save(link));
    }

    public List<TicketWikiLinkResponse> findByTicket(Long glpiTicketId) {
        if (glpiTicketId == null || glpiTicketId <= 0) return List.of();
        return repo.findByGlpiTicketIdOrderByCreatedAtDesc(glpiTicketId).stream()
                .map(TicketWikiLinkResponse::from)
                .toList();
    }

    public List<TicketWikiLinkResponse> findByArticle(UUID wikiArticleId) {
        if (wikiArticleId == null) return List.of();
        return repo.findByWikiArticleIdOrderByCreatedAtDesc(wikiArticleId).stream()
                .map(TicketWikiLinkResponse::from)
                .toList();
    }
}
