package br.com.nexusit.alerttriage;

import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

import java.util.List;
import java.util.Optional;
import java.util.UUID;

public interface AlertTriageRuleRepository extends JpaRepository<AlertTriageRule, UUID> {
    List<AlertTriageRule> findByEnabledTrueOrderByUpdatedAtDesc();
    List<AlertTriageRule> findAllByOrderByUpdatedAtDesc();

    @Query("""
            select r from AlertTriageRule r
             where r.hostPattern = :hostPattern
               and r.alertPattern = :alertPattern
               and r.severityMin = :severityMin
               and r.severityMax = :severityMax
               and r.action = :action
             order by r.enabled desc, r.updatedAt desc, r.createdAt desc
            """)
    List<AlertTriageRule> findReusableDecisionRules(
            @Param("hostPattern") String hostPattern,
            @Param("alertPattern") String alertPattern,
            @Param("severityMin") Integer severityMin,
            @Param("severityMax") Integer severityMax,
            @Param("action") AlertTriageAction action);

    default Optional<AlertTriageRule> findReusableDecisionRule(String hostPattern, String alertPattern, Integer severityMin, Integer severityMax, AlertTriageAction action) {
        return findReusableDecisionRules(hostPattern, alertPattern, severityMin, severityMax, action).stream().findFirst();
    }
}
