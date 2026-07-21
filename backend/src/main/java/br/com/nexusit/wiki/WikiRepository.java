package br.com.nexusit.wiki;

import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import java.util.List;
import java.util.UUID;

public interface WikiRepository extends JpaRepository<WikiArticle, UUID> {
    List<WikiArticle> findAllByOrderByUpdatedAtDesc();
    List<WikiArticle> findByCategoryOrderByUpdatedAtDesc(String category);

    /**
     * tsQuery já vem pronto (ex.: "(computador|notebook|pc) & (lento|travando)") — ver
     * WikiService.buildTsQuery. Casa por texto completo (com stemming em português) OU por
     * semelhança de título (tolera erro de digitação), ordenado por relevância de cada sinal.
     */
    @Query(value = """
            SELECT w.id, w.title, w.category, w.content, w.tags, w.author_id, w.created_at, w.updated_at
              FROM wiki_articles w
             WHERE w.search_vector @@ to_tsquery('portuguese', :tsQuery)
                OR similarity(w.title, :rawQuery) > 0.25
             ORDER BY ts_rank_cd(w.search_vector, to_tsquery('portuguese', :tsQuery)) DESC,
                      similarity(w.title, :rawQuery) DESC
             LIMIT 60
            """, nativeQuery = true)
    List<WikiArticle> searchFullText(@Param("tsQuery") String tsQuery, @Param("rawQuery") String rawQuery);
}
