package br.com.nexusit.incident;

import org.springframework.data.jpa.repository.JpaRepository;
import java.util.List;
import java.util.UUID;

public interface IncidentActionResultRepository extends JpaRepository<IncidentActionResult, UUID> {
    List<IncidentActionResult> findTop20ByIncidentIdOrderByExecutedAtDesc(UUID incidentId);
}
