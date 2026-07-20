package br.com.nexusit.broadcast;

import org.springframework.data.jpa.repository.JpaRepository;

import java.util.List;
import java.util.UUID;

public interface NotificationRuleRepository extends JpaRepository<NotificationRule, UUID> {
    List<NotificationRule> findAllByOrderByNameAsc();
    List<NotificationRule> findByModeAndActiveTrue(RuleMode mode);
}
