package br.com.nexusit.backup;

import org.springframework.data.jpa.repository.JpaRepository;
import java.util.List;
import java.util.UUID;

public interface BackupJobRepository extends JpaRepository<BackupJob, UUID> {
    List<BackupJob> findAllByOrderBySystemNameAscNameAsc();
}
