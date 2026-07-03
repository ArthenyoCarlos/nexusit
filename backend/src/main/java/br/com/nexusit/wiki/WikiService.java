package br.com.nexusit.wiki;

import br.com.nexusit.user.User;
import br.com.nexusit.ticketwiki.TicketWikiLinkRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;
import java.util.List;
import java.util.Map;
import java.util.UUID;
import java.util.stream.Collectors;

@Service @RequiredArgsConstructor
public class WikiService {
    private final WikiRepository repo;
    private final TicketWikiLinkRepository ticketWikiLinkRepository;

    private List<WikiResponse> withUsageCounts(List<WikiArticle> articles) {
        if (articles == null || articles.isEmpty()) return List.of();
        Map<UUID, Long> counts = ticketWikiLinkRepository.countByWikiArticleIds(
                articles.stream().map(WikiArticle::getId).toList()
        ).stream().collect(Collectors.toMap(
                TicketWikiLinkRepository.WikiArticleLinkCount::getWikiArticleId,
                TicketWikiLinkRepository.WikiArticleLinkCount::getLinkedTicketCount,
                Long::sum
        ));
        return articles.stream()
                .map(article -> WikiResponse.from(article, counts.getOrDefault(article.getId(), 0L)))
                .toList();
    }

    public List<WikiResponse> findAll(String category) {
        if (category != null && !category.isBlank())
            return withUsageCounts(repo.findByCategoryOrderByUpdatedAtDesc(category));
        return withUsageCounts(repo.findAllByOrderByUpdatedAtDesc());
    }

    public WikiResponse findById(UUID id) {
        WikiArticle article = repo.findById(id).orElseThrow();
        long count = ticketWikiLinkRepository.countByWikiArticleId(id);
        return WikiResponse.from(article, count);
    }

    public List<WikiResponse> search(String q) { return withUsageCounts(repo.search(q)); }

    public WikiResponse create(WikiRequest req, User user) {
        WikiArticle a = WikiArticle.builder()
                .title(req.title()).category(req.category() != null ? req.category() : "Geral")
                .content(req.content() != null ? req.content() : "").tags(req.tags()).author(user).build();
        return WikiResponse.from(repo.save(a));
    }

    public WikiResponse update(UUID id, WikiRequest req) {
        WikiArticle a = repo.findById(id).orElseThrow();
        a.setTitle(req.title()); a.setCategory(req.category()); a.setContent(req.content()); a.setTags(req.tags());
        return WikiResponse.from(repo.save(a));
    }

    public void delete(UUID id) { repo.deleteById(id); }
}
