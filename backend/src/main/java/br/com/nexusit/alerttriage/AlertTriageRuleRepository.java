package br.com.nexusit.alerttriage;

import org.springframework.data.jpa.repository.JpaRepository;

import java.util.List;
import java.util.UUID;

public interface AlertTriageRuleRepository extends JpaRepository<AlertTriageRule, UUID> {
    List<AlertTriageRule> findByEnabledTrueOrderByUpdatedAtDesc();
    List<AlertTriageRule> findAllByOrderByUpdatedAtDesc();
}
