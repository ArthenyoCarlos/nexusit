package br.com.nexusit.wiki;

import br.com.nexusit.user.User;
import br.com.nexusit.ticketwiki.TicketWikiLinkRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;

import java.text.Normalizer;
import java.time.LocalDateTime;
import java.time.temporal.ChronoUnit;
import java.util.Arrays;
import java.util.Comparator;
import java.util.LinkedHashSet;
import java.util.List;
import java.util.Locale;
import java.util.Map;
import java.util.Set;
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

    /**
     * Busca por relevância local (sem LLM externo): pontua cada artigo pelos tokens da
     * consulta em título/categoria/tags/conteúdo, mais sinais de uso e recência —
     * mesmo espírito heurístico do scoreWikiSuggestion do frontend (ticketIntelligence.js).
     */
    public List<WikiResponse> search(String q) {
        List<String> tokens = tokenize(q);
        if (tokens.isEmpty()) return List.of();

        String normalizedQuery = normalize(q);
        List<WikiArticle> articles = repo.findAllByOrderByUpdatedAtDesc();

        Map<UUID, Long> counts = ticketWikiLinkRepository.countByWikiArticleIds(
                articles.stream().map(WikiArticle::getId).toList()
        ).stream().collect(Collectors.toMap(
                TicketWikiLinkRepository.WikiArticleLinkCount::getWikiArticleId,
                TicketWikiLinkRepository.WikiArticleLinkCount::getLinkedTicketCount,
                Long::sum
        ));

        return articles.stream()
                .map(a -> Map.entry(a, scoreArticle(a, tokens, normalizedQuery, counts.getOrDefault(a.getId(), 0L))))
                .filter(e -> e.getValue() > 0)
                .sorted(Comparator.comparingInt((Map.Entry<WikiArticle, Integer> e) -> e.getValue()).reversed())
                .limit(30)
                .map(e -> WikiResponse.from(e.getKey(), counts.getOrDefault(e.getKey().getId(), 0L)))
                .toList();
    }

    private int scoreArticle(WikiArticle a, List<String> tokens, String normalizedQuery, long usageCount) {
        String title = normalize(a.getTitle());
        String category = normalize(a.getCategory());
        String tags = normalize(a.getTags());
        String content = normalize(a.getContent());
        String haystack = title + " " + category + " " + tags + " " + content;

        int score = 0;
        for (String token : tokens) {
            if (!haystack.contains(token)) continue;
            score += 4;
            if (title.contains(token)) score += 6;
            if (category.contains(token)) score += 8;
            if (tags.contains(token)) score += 6;
        }
        if (score == 0) return 0;

        if (!normalizedQuery.isBlank() && title.contains(normalizedQuery)) score += 12;
        if (usageCount > 0) score += (int) Math.min(usageCount, 5) * 3;
        if (a.getUpdatedAt() != null && ChronoUnit.DAYS.between(a.getUpdatedAt(), LocalDateTime.now()) <= 30) score += 4;

        return score;
    }

    private String normalize(String s) {
        if (s == null) return "";
        String n = Normalizer.normalize(s, Normalizer.Form.NFD).replaceAll("\\p{M}", "");
        return n.toLowerCase(Locale.ROOT).trim();
    }

    private List<String> tokenize(String q) {
        if (q == null || q.isBlank()) return List.of();
        Set<String> unique = new LinkedHashSet<>();
        Arrays.stream(normalize(q).split("[^a-z0-9]+"))
                .filter(t -> t.length() >= 3)
                .forEach(unique::add);
        return List.copyOf(unique);
    }

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
