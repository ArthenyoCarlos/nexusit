package br.com.nexusit.onboarding;

import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

import java.util.List;
import java.util.Optional;
import java.util.UUID;

public interface ChecklistRepository extends JpaRepository<Checklist, UUID> {

    @Query("SELECT c FROM Checklist c LEFT JOIN FETCH c.createdBy WHERE (:type IS NULL OR c.type = :type) ORDER BY c.createdAt DESC")
    List<Checklist> findByType(@Param("type") String type);

    @Query("SELECT c FROM Checklist c LEFT JOIN FETCH c.items LEFT JOIN FETCH c.createdBy WHERE c.id = :id")
    Optional<Checklist> findByIdWithItems(@Param("id") UUID id);
}
