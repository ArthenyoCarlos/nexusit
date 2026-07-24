package br.com.nexusit.incident;

import org.springframework.data.jpa.repository.JpaRepository;

import java.time.LocalDateTime;
import java.util.List;
import java.util.UUID;

public interface CorrelatedIncidentEventRepository extends JpaRepository<CorrelatedIncidentEvent, UUID> {
    List<CorrelatedIncidentEvent> findTop20ByIncidentIdOrderByObservedAtDesc(UUID incidentId);
    long countByIncidentIdAndObservedAtAfter(UUID incidentId, LocalDateTime since);
}
