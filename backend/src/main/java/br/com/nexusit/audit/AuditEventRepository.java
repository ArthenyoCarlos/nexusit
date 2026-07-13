package br.com.nexusit.audit;

import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

import java.time.LocalDateTime;
import java.util.List;
import java.util.UUID;

public interface AuditEventRepository extends JpaRepository<AuditEvent, UUID> {

    @Query("""
            SELECT e FROM AuditEvent e
            WHERE e.createdAt >= :since
              AND (:module IS NULL OR e.module = :module)
            ORDER BY e.createdAt DESC
            """)
    List<AuditEvent> findRecent(@Param("since") LocalDateTime since, @Param("module") AuditModule module);
}
