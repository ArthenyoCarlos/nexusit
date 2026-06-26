package br.com.nexusit.wiki;

import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import java.util.List;
import java.util.UUID;

public interface WikiRepository extends JpaRepository<WikiArticle, UUID> {
    List<WikiArticle> findAllByOrderByUpdatedAtDesc();
    List<WikiArticle> findByCategoryOrderByUpdatedAtDesc(String category);

    @Query("SELECT a FROM WikiArticle a WHERE LOWER(a.title) LIKE LOWER(CONCAT('%',:q,'%')) OR LOWER(a.content) LIKE LOWER(CONCAT('%',:q,'%'))")
    List<WikiArticle> search(@Param("q") String q);
}
