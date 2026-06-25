package br.com.nexusit.notes;

import br.com.nexusit.user.User;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

import java.util.List;
import java.util.UUID;

public interface NoteRepository extends JpaRepository<Note, UUID> {

    @Query("""
            SELECT DISTINCT n FROM Note n
            LEFT JOIN FETCH n.tags
            LEFT JOIN FETCH n.author
            WHERE n.visibility = 'SHARED' OR n.author = :user
            ORDER BY n.updatedAt DESC
            """)
    List<Note> findVisibleToUser(@Param("user") User user);

    @Query("""
            SELECT DISTINCT n FROM Note n
            LEFT JOIN FETCH n.tags
            LEFT JOIN FETCH n.author
            WHERE (n.visibility = 'SHARED' OR n.author = :user)
              AND (:q IS NULL OR LOWER(n.title) LIKE LOWER(CONCAT('%', :q, '%'))
                             OR LOWER(COALESCE(n.content, '')) LIKE LOWER(CONCAT('%', :q, '%')))
            ORDER BY n.updatedAt DESC
            """)
    List<Note> searchByText(@Param("user") User user, @Param("q") String q);
}
