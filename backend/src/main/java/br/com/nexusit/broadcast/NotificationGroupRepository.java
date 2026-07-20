package br.com.nexusit.broadcast;

import org.springframework.data.jpa.repository.JpaRepository;

import java.util.List;
import java.util.Optional;
import java.util.UUID;

public interface NotificationGroupRepository extends JpaRepository<NotificationGroup, UUID> {
    List<NotificationGroup> findByActiveTrueOrderByNameAsc();
    Optional<NotificationGroup> findByGroupJid(String groupJid);
}
