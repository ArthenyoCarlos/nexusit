package br.com.nexusit.backup;

import org.springframework.data.jpa.repository.JpaRepository;
import java.util.List;
import java.util.Optional;
import java.util.UUID;

public interface BackupRunRepository extends JpaRepository<BackupRun, UUID> {
    Optional<BackupRun> findTopByJobIdOrderByFinishedAtDesc(UUID jobId);
    List<BackupRun> findTop20ByJobIdOrderByFinishedAtDesc(UUID jobId);
}
