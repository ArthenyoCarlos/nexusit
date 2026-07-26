package br.com.nexusit.incident;

import org.springframework.data.jpa.repository.JpaRepository;

import java.util.List;
import java.util.Optional;
import java.util.UUID;

public interface IncidentResolutionCheckRepository extends JpaRepository<IncidentResolutionCheck, UUID> {
    Optional<IncidentResolutionCheck> findTopByIncidentIdOrderByCheckedAtDesc(UUID incidentId);
    List<IncidentResolutionCheck> findTop20ByIncidentIdOrderByCheckedAtDesc(UUID incidentId);
}
