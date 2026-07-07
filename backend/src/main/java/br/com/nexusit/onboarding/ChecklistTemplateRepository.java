package br.com.nexusit.onboarding;

import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

import java.util.List;
import java.util.Optional;
import java.util.UUID;

public interface ChecklistTemplateRepository extends JpaRepository<ChecklistTemplate, UUID> {

    @Query("SELECT t FROM ChecklistTemplate t WHERE (:type IS NULL OR t.type = :type) ORDER BY t.name")
    List<ChecklistTemplate> findByType(@Param("type") String type);

    @Query("SELECT t FROM ChecklistTemplate t WHERE t.type = :type AND t.active = true ORDER BY t.name")
    List<ChecklistTemplate> findActiveByType(@Param("type") String type);

    @Query("SELECT t FROM ChecklistTemplate t LEFT JOIN FETCH t.items WHERE t.id = :id")
    Optional<ChecklistTemplate> findByIdWithItems(@Param("id") UUID id);
}
