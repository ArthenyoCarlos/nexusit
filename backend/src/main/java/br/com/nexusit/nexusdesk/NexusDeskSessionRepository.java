package br.com.nexusit.nexusdesk;

import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;

import java.util.List;
import java.util.UUID;

public interface NexusDeskSessionRepository extends JpaRepository<NexusDeskSession, UUID> {

    @Query("SELECT s FROM NexusDeskSession s LEFT JOIN FETCH s.device LEFT JOIN FETCH s.user " +
            "ORDER BY s.startedAt DESC")
    List<NexusDeskSession> findAllWithRelations();
}
