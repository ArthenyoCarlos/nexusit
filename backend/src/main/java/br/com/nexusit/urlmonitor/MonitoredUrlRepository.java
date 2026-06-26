package br.com.nexusit.urlmonitor;

import org.springframework.data.jpa.repository.JpaRepository;

import java.util.List;
import java.util.UUID;

public interface MonitoredUrlRepository extends JpaRepository<MonitoredUrl, UUID> {
    List<MonitoredUrl> findByEnabledTrueOrderByNameAsc();
    List<MonitoredUrl> findAllByOrderByNameAsc();
}
