package br.com.nexusit.inventory;

import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

import java.util.Optional;
import java.util.UUID;

public interface InventoryRepository extends JpaRepository<InventoryItem, UUID> {

    @Query("SELECT MAX(i.tombamento) FROM InventoryItem i WHERE i.tombamento LIKE CONCAT('GAL-', :year, '-%')")
    Optional<String> findMaxTombamentoForYear(@Param("year") String year);

    @Query(value = """
            SELECT i FROM InventoryItem i
            LEFT JOIN FETCH i.responsible r
            WHERE (:type IS NULL OR i.type = :type)
              AND (:status IS NULL OR i.status = :status)
              AND (:search IS NULL OR :search = ''
                   OR LOWER(i.name) LIKE LOWER(CONCAT('%', :search, '%'))
                   OR LOWER(COALESCE(i.serialNumber, '')) LIKE LOWER(CONCAT('%', :search, '%')))
              AND (:tombamento IS NULL OR :tombamento = '' OR LOWER(i.tombamento) = LOWER(:tombamento))
              AND (:name IS NULL OR :name = '' OR LOWER(i.name) = LOWER(:name))
              AND (:brand IS NULL OR :brand = '' OR LOWER(i.brand) = LOWER(:brand))
              AND (:model IS NULL OR :model = '' OR LOWER(i.model) = LOWER(:model))
              AND (:serialNumber IS NULL OR :serialNumber = '' OR LOWER(i.serialNumber) = LOWER(:serialNumber))
              AND (:location IS NULL OR :location = '' OR LOWER(i.location) = LOWER(:location))
              AND (:responsibleName IS NULL OR :responsibleName = '' OR LOWER(r.name) = LOWER(:responsibleName))
            """,
            countQuery = """
            SELECT COUNT(i) FROM InventoryItem i
            LEFT JOIN i.responsible r
            WHERE (:type IS NULL OR i.type = :type)
              AND (:status IS NULL OR i.status = :status)
              AND (:search IS NULL OR :search = ''
                   OR LOWER(i.name) LIKE LOWER(CONCAT('%', :search, '%'))
                   OR LOWER(COALESCE(i.serialNumber, '')) LIKE LOWER(CONCAT('%', :search, '%')))
              AND (:tombamento IS NULL OR :tombamento = '' OR LOWER(i.tombamento) = LOWER(:tombamento))
              AND (:name IS NULL OR :name = '' OR LOWER(i.name) = LOWER(:name))
              AND (:brand IS NULL OR :brand = '' OR LOWER(i.brand) = LOWER(:brand))
              AND (:model IS NULL OR :model = '' OR LOWER(i.model) = LOWER(:model))
              AND (:serialNumber IS NULL OR :serialNumber = '' OR LOWER(i.serialNumber) = LOWER(:serialNumber))
              AND (:location IS NULL OR :location = '' OR LOWER(i.location) = LOWER(:location))
              AND (:responsibleName IS NULL OR :responsibleName = '' OR LOWER(r.name) = LOWER(:responsibleName))
            """)
    Page<InventoryItem> findByFilters(
            @Param("type") ItemType type,
            @Param("status") ItemStatus status,
            @Param("search") String search,
            @Param("tombamento") String tombamento,
            @Param("name") String name,
            @Param("brand") String brand,
            @Param("model") String model,
            @Param("serialNumber") String serialNumber,
            @Param("location") String location,
            @Param("responsibleName") String responsibleName,
            Pageable pageable
    );
}
