package br.com.nexusit.cartridge;

import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

import java.util.Optional;
import java.util.UUID;

public interface CartridgeRepository extends JpaRepository<Cartridge, UUID> {
    Optional<Cartridge> findByCode(String code);

    @Query(value = "SELECT nextval('cartridge_code_seq')", nativeQuery = true)
    long nextCodeSequence();

    @Query("""
            SELECT c FROM Cartridge c
            WHERE (:status IS NULL OR c.status = :status)
              AND (:search IS NULL OR :search = ''
                   OR LOWER(c.model) LIKE LOWER(CONCAT('%', :search, '%'))
                   OR LOWER(c.code) LIKE LOWER(CONCAT('%', :search, '%'))
                   OR LOWER(COALESCE(c.currentSector, '')) LIKE LOWER(CONCAT('%', :search, '%'))
                   OR LOWER(COALESCE(c.printerModel, '')) LIKE LOWER(CONCAT('%', :search, '%')))
              AND (:code IS NULL OR LOWER(c.code) = LOWER(:code))
              AND (:model IS NULL OR LOWER(c.model) = LOWER(:model))
              AND (:printerModel IS NULL OR LOWER(c.printerModel) = LOWER(:printerModel))
              AND (:currentSector IS NULL OR LOWER(c.currentSector) = LOWER(:currentSector))
            """)
    Page<Cartridge> findByFilters(
            @Param("status") CartridgeStatus status,
            @Param("search") String search,
            @Param("code") String code,
            @Param("model") String model,
            @Param("printerModel") String printerModel,
            @Param("currentSector") String currentSector,
            Pageable pageable
    );
}
