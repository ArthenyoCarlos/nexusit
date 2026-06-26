package br.com.nexusit.vault;

import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

import java.util.List;
import java.util.UUID;

public interface CredentialRepository extends JpaRepository<Credential, UUID> {

    @Query("""
            SELECT c FROM Credential c LEFT JOIN FETCH c.createdBy
            WHERE (:search IS NULL OR LOWER(c.title) LIKE LOWER(CONCAT('%',:search,'%'))
                   OR LOWER(COALESCE(c.tags,'')) LIKE LOWER(CONCAT('%',:search,'%')))
              AND (:type IS NULL OR c.type = :type)
            ORDER BY c.title
            """)
    List<Credential> findByFilters(@Param("search") String search, @Param("type") String type);
}
