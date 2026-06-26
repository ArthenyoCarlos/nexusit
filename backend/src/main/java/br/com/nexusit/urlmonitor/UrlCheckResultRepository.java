package br.com.nexusit.urlmonitor;

import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

import java.util.List;
import java.util.UUID;

public interface UrlCheckResultRepository extends JpaRepository<UrlCheckResult, UUID> {

    @Query("SELECT r FROM UrlCheckResult r WHERE r.monitor.id = :id ORDER BY r.checkedAt DESC")
    List<UrlCheckResult> findTop50ByMonitorId(@Param("id") UUID id, org.springframework.data.domain.Pageable pageable);
}
