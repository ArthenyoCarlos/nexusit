package br.com.nexusit.system;

import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

import java.util.List;
import java.util.Optional;
import java.util.UUID;

public interface SystemRepository extends JpaRepository<SystemEntry, UUID> {

    @Query("""
            SELECT s FROM SystemEntry s
            LEFT JOIN FETCH s.responsible
            LEFT JOIN FETCH s.server
            WHERE (:category IS NULL OR s.category = :category)
              AND (:status IS NULL OR s.status = :status)
            ORDER BY s.name
            """)
    List<SystemEntry> findByFilters(
            @Param("category") SystemCategory category,
            @Param("status") SystemStatus status
    );

    @Query("SELECT s FROM SystemEntry s LEFT JOIN FETCH s.responsible LEFT JOIN FETCH s.server WHERE s.id = :id")
    Optional<SystemEntry> findByIdWithRelations(@Param("id") UUID id);
}
