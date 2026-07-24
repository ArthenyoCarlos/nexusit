package br.com.nexusit.monitoring;

import org.springframework.data.jpa.repository.JpaRepository;

import java.time.LocalDateTime;
import java.util.List;
import java.util.UUID;

public interface UnifiApMetricSampleRepository extends JpaRepository<UnifiApMetricSample, UUID> {
    List<UnifiApMetricSample> findByApNameAndRecordedAtAfterOrderByRecordedAtAsc(String apName, LocalDateTime since);
    List<UnifiApMetricSample> findByRecordedAtAfterOrderByApNameAscRecordedAtAsc(LocalDateTime since);
}
