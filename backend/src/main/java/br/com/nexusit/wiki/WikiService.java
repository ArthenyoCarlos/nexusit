package br.com.nexusit.wiki;

import br.com.nexusit.user.User;
import br.com.nexusit.ticketwiki.TicketWikiLinkRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;

import java.text.Normalizer;
import java.time.LocalDateTime;
import java.time.temporal.ChronoUnit;
import java.util.ArrayList;
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

    // Grupos de sinônimos comuns em chamados de TI — cada grupo vira "OR" dentro da busca
    // full-text (ver buildTsQuery), então procurar "computador" também acha artigos que só
    // mencionam "notebook" ou "PC". Sem isso, o stemming do Postgres resolve plural/conjugação
    // ("impressoras" ~ "impressora") mas não sinônimo de fato — essa lista cobre esse resto.
    private static final List<Set<String>> SYNONYM_GROUPS = List.of(
            Set.of("internet", "rede", "wifi", "conexao", "conectividade", "link"),
            Set.of("lento", "lenta", "devagar", "travando", "travado", "trava", "lentidao"),
            Set.of("impressora", "imprimir", "impressao", "toner", "printer"),
            Set.of("senha", "acesso", "login", "logon", "autenticacao", "credencial"),
            Set.of("computador", "notebook", "maquina", "pc", "desktop", "note"),
            Set.of("sistema", "winthor", "erp", "pdv", "software", "aplicativo"),
            Set.of("coletor", "leitor", "mobile", "celular", "android", "smartphone"),
            Set.of("email", "correio", "outlook"),
            Set.of("caiu", "fora", "indisponivel", "parado", "queda", "desligou", "reiniciou"),
            Set.of("erro", "falha", "problema", "bug", "defeito"),
            Set.of("backup", "copia", "seguranca"),
            Set.of("monitor", "tela", "display"),
            Set.of("teclado", "mouse", "periferico")
    );

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
     * Busca com full-text search do Postgres (stemming em português — "impressoras" acha
     * "impressora" sozinho) + expansão de sinônimos de TI (ver SYNONYM_GROUPS) + similaridade
     * de título (tolera erro de digitação), tudo sem depender de LLM/API externa. O Postgres já
     * devolve os candidatos ordenados por relevância textual; aqui só aplicamos por cima os
     * mesmos bônus de negócio de sempre (uso em chamados, recência).
     */
    public List<WikiResponse> search(String q) {
        List<String> tokens = tokenize(q);
        if (tokens.isEmpty()) return List.of();

        String tsQuery = buildTsQuery(tokens);
        String rawQuery = normalize(q);
        List<WikiArticle> candidates = repo.searchFullText(tsQuery, rawQuery);
        if (candidates.isEmpty()) return List.of();

        Map<UUID, Long> counts = ticketWikiLinkRepository.countByWikiArticleIds(
                candidates.stream().map(WikiArticle::getId).toList()
        ).stream().collect(Collectors.toMap(
                TicketWikiLinkRepository.WikiArticleLinkCount::getWikiArticleId,
                TicketWikiLinkRepository.WikiArticleLinkCount::getLinkedTicketCount,
                Long::sum
        ));

        List<Map.Entry<WikiArticle, Integer>> scored = new ArrayList<>();
        for (int i = 0; i < candidates.size(); i++) {
            WikiArticle a = candidates.get(i);
            int textScore = Math.max(1, candidates.size() - i) * 3;
            long usageCount = counts.getOrDefault(a.getId(), 0L);
            int bonus = (int) Math.min(usageCount, 5) * 3;
            if (a.getUpdatedAt() != null && ChronoUnit.DAYS.between(a.getUpdatedAt(), LocalDateTime.now()) <= 30) bonus += 4;
            scored.add(Map.entry(a, textScore + bonus));
        }

        return scored.stream()
                .sorted(Comparator.comparingInt((Map.Entry<WikiArticle, Integer> e) -> e.getValue()).reversed())
                .limit(30)
                .map(e -> WikiResponse.from(e.getKey(), counts.getOrDefault(e.getKey().getId(), 0L)))
                .toList();
    }

    /** Ex.: tokens ["computador","lento"] -> "(computador|notebook|pc|...) & (lento|devagar|...)" */
    private String buildTsQuery(List<String> tokens) {
        return tokens.stream()
                .map(this::expandToken)
                .collect(Collectors.joining(" & "));
    }

    private String expandToken(String token) {
        Set<String> group = SYNONYM_GROUPS.stream()
                .filter(g -> g.contains(token))
                .findFirst()
                .orElse(Set.of(token));
        return "(" + String.join("|", group) + ")";
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
