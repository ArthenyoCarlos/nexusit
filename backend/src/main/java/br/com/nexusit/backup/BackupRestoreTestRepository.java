package br.com.nexusit.backup;

import org.springframework.data.jpa.repository.JpaRepository;
import java.util.List;
import java.util.Optional;
import java.util.UUID;

public interface BackupRestoreTestRepository extends JpaRepository<BackupRestoreTest, UUID> {
    Optional<BackupRestoreTest> findTopByJobIdOrderByTestedAtDesc(UUID jobId);
    List<BackupRestoreTest> findTop20ByJobIdOrderByTestedAtDesc(UUID jobId);
}
