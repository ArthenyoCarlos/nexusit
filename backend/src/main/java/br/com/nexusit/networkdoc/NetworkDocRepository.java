package br.com.nexusit.networkdoc;

import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

import java.util.List;
import java.util.Optional;
import java.util.UUID;

public interface NetworkDocRepository extends JpaRepository<NetworkDoc, UUID> {

    @Query("SELECT d FROM NetworkDoc d LEFT JOIN FETCH d.updatedBy ORDER BY d.section ASC, d.updatedAt DESC")
    List<NetworkDoc> findAllWithUpdatedBy();

    @Query("SELECT d FROM NetworkDoc d LEFT JOIN FETCH d.updatedBy WHERE d.section = :section ORDER BY d.updatedAt DESC")
    List<NetworkDoc> findBySectionFetched(@Param("section") String section);

    @Query("SELECT d FROM NetworkDoc d LEFT JOIN FETCH d.updatedBy WHERE d.id = :id")
    Optional<NetworkDoc> findByIdFetched(@Param("id") UUID id);
}
