package br.com.nexusit.backup;

import org.springframework.data.jpa.repository.JpaRepository;
import java.util.List;
import java.util.UUID;

public interface BackupActionRequestRepository extends JpaRepository<BackupActionRequest, UUID> {
    List<BackupActionRequest> findTop20ByJobIdOrderByRequestedAtDesc(UUID jobId);
}
