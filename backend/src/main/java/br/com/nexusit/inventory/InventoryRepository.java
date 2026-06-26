package br.com.nexusit.inventory;

import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

import java.util.List;
import java.util.Optional;
import java.util.UUID;

public interface InventoryRepository extends JpaRepository<InventoryItem, UUID> {

    @Query("SELECT MAX(i.tombamento) FROM InventoryItem i WHERE i.tombamento LIKE CONCAT('GAL-', :year, '-%')")
    Optional<String> findMaxTombamentoForYear(@Param("year") String year);

    @Query("""
            SELECT i FROM InventoryItem i
            LEFT JOIN FETCH i.responsible
            WHERE (:type IS NULL OR i.type = :type)
              AND (:status IS NULL OR i.status = :status)
            ORDER BY i.name
            """)
    List<InventoryItem> findByTypeAndStatus(
            @Param("type") ItemType type,
            @Param("status") ItemStatus status
    );

    @Query("""
            SELECT i FROM InventoryItem i
            LEFT JOIN FETCH i.responsible
            WHERE (:type IS NULL OR i.type = :type)
              AND (:status IS NULL OR i.status = :status)
              AND (LOWER(i.name) LIKE LOWER(CONCAT('%', :search, '%'))
                   OR LOWER(COALESCE(i.serialNumber, '')) LIKE LOWER(CONCAT('%', :search, '%')))
            ORDER BY i.name
            """)
    List<InventoryItem> findByFiltersWithSearch(
            @Param("type") ItemType type,
            @Param("status") ItemStatus status,
            @Param("search") String search
    );

    @Query("SELECT i FROM InventoryItem i LEFT JOIN FETCH i.responsible ORDER BY i.name")
    List<InventoryItem> findAllWithResponsible();
}
