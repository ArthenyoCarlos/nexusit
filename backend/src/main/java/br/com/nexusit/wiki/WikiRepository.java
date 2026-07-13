package br.com.nexusit.wiki;

import org.springframework.data.jpa.repository.JpaRepository;
import java.util.List;
import java.util.UUID;

public interface WikiRepository extends JpaRepository<WikiArticle, UUID> {
    List<WikiArticle> findAllByOrderByUpdatedAtDesc();
    List<WikiArticle> findByCategoryOrderByUpdatedAtDesc(String category);
}
