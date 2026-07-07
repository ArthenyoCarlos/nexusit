package br.com.nexusit.onboarding;

import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

import java.util.List;
import java.util.Optional;
import java.util.UUID;

public interface ChecklistRepository extends JpaRepository<Checklist, UUID> {

    @Query("SELECT c FROM Checklist c LEFT JOIN FETCH c.createdBy LEFT JOIN FETCH c.employeeUser " +
            "WHERE (:type IS NULL OR c.type = :type) AND (:status IS NULL OR c.status = :status) " +
            "ORDER BY c.createdAt DESC")
    List<Checklist> findByTypeAndStatus(@Param("type") String type, @Param("status") ChecklistStatus status);

    @Query("SELECT c FROM Checklist c LEFT JOIN FETCH c.items LEFT JOIN FETCH c.createdBy " +
            "LEFT JOIN FETCH c.employeeUser LEFT JOIN FETCH c.inventoryItem WHERE c.id = :id")
    Optional<Checklist> findByIdWithItems(@Param("id") UUID id);
}
