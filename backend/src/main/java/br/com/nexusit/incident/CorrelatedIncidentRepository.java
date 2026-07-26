package br.com.nexusit.incident;

import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.JpaSpecificationExecutor;

import java.time.LocalDateTime;
import java.util.List;
import java.util.Optional;
import java.util.UUID;

public interface CorrelatedIncidentRepository extends JpaRepository<CorrelatedIncident, UUID>, JpaSpecificationExecutor<CorrelatedIncident> {
    Optional<CorrelatedIncident> findByCorrelationKey(String correlationKey);
    List<CorrelatedIncident> findTop50ByStatusOrderByLastSeenAtDesc(String status);
    List<CorrelatedIncident> findTop200ByStatusOrderByLastSeenAtAsc(String status);
    List<CorrelatedIncident> findByLastSeenAtAfterOrderByLastSeenAtDesc(LocalDateTime since);
}
