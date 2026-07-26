package br.com.nexusit.incident;

import br.com.nexusit.monitoring.ZabbixProblem;
import br.com.nexusit.monitoring.ZabbixService;
import lombok.RequiredArgsConstructor;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.security.core.Authentication;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.Duration;
import java.time.LocalDateTime;
import java.util.*;
import java.util.stream.Collectors;

@Service
@RequiredArgsConstructor
@Transactional(readOnly = true)
public class IncidentAutoResolutionService {
    private final CorrelatedIncidentRepository incidentRepository;
    private final IncidentResolutionCheckRepository checkRepository;
    private final CorrelatedIncidentService incidentService;
    private final ZabbixService zabbixService;

    @Value("${nexusit.incidents.auto-resolution.stability-minutes:${INCIDENT_AUTO_RESOLUTION_STABILITY_MINUTES:15}}")
    private int stabilityMinutes;

    @Value("${nexusit.incidents.auto-resolution.flapping-occurrences:${INCIDENT_AUTO_RESOLUTION_FLAPPING_OCCURRENCES:3}}")
    private int flappingOccurrences;

    public static IncidentAutoResolutionDecision decide(CorrelatedIncident incident, Set<String> activeSourceKeys, LocalDateTime now, int stabilityMinutes, int flappingOccurrences) {
        if (incident == null) return new IncidentAutoResolutionDecision("SKIPPED", "Incidente inexistente.", 0, false);
        if (!"OPEN".equalsIgnoreCase(nvl(incident.getStatus()))) {
            return new IncidentAutoResolutionDecision("SKIPPED", "Incidente não está aberto.", 0, false);
        }
        if (activeSourceKeys.contains(nvl(incident.getCorrelationKey()))) {
            return new IncidentAutoResolutionDecision("ACTIVE", "Fonte ainda reporta o alerta ativo.", 0, true);
        }
        LocalDateTime lastSeen = incident.getLastSeenAt() == null ? now : incident.getLastSeenAt();
        int stable = (int) Math.max(0, Duration.between(lastSeen, now).toMinutes());
        if (stable < stabilityMinutes) {
            return new IncidentAutoResolutionDecision("WAITING_STABILITY", "Alerta sumiu da fonte, aguardando estabilidade: " + stable + "/" + stabilityMinutes + " minutos.", stable, false);
        }
        if (incident.getSeverity() >= 5 && incident.getOccurrenceCount() >= flappingOccurrences) {
            return new IncidentAutoResolutionDecision("SKIPPED_FLAPPING", "Incidente crítico com possível oscilação; manter aberto para validação manual.", stable, false);
        }
        return new IncidentAutoResolutionDecision("AUTO_RESOLVED", "Alerta ausente da fonte por " + stable + " minutos; resolvido automaticamente pelo NexusIT.", stable, false);
    }

    public IncidentAutoResolutionSummary status(UUID incidentId) {
        CorrelatedIncident incident = incidentRepository.findById(incidentId).orElseThrow();
        IncidentResolutionCheck latest = checkRepository.findTopByIncidentIdOrderByCheckedAtDesc(incidentId).orElse(null);
        List<IncidentResolutionCheckResponse> recent = checkRepository.findTop20ByIncidentIdOrderByCheckedAtDesc(incidentId)
                .stream().map(IncidentResolutionCheckResponse::from).toList();
        return new IncidentAutoResolutionSummary(CorrelatedIncidentResponse.from(incident), IncidentResolutionCheckResponse.from(latest), recent);
    }

    @Transactional
    public IncidentAutoResolutionCheckResult checkOne(UUID incidentId, Authentication auth) {
        Set<String> active = activeZabbixKeys();
        CorrelatedIncident incident = incidentRepository.findById(incidentId).orElseThrow();
        return applyDecision(incident, active, LocalDateTime.now(), auth == null ? "system" : auth.getName());
    }

    @Transactional
    public IncidentAutoResolutionBatchResult checkOpen(Authentication auth) {
        Set<String> active = activeZabbixKeys();
        LocalDateTime now = LocalDateTime.now();
        String actor = auth == null ? "system" : auth.getName();
        List<IncidentAutoResolutionCheckResult> results = incidentRepository.findTop200ByStatusOrderByLastSeenAtAsc("OPEN")
                .stream()
                .map(i -> applyDecision(i, active, now, actor))
                .toList();
        long resolved = results.stream().filter(r -> "AUTO_RESOLVED".equals(r.decision().status())).count();
        long activeCount = results.stream().filter(r -> "ACTIVE".equals(r.decision().status())).count();
        long waiting = results.stream().filter(r -> "WAITING_STABILITY".equals(r.decision().status())).count();
        long skipped = results.size() - resolved - activeCount - waiting;
        return new IncidentAutoResolutionBatchResult(results.size(), resolved, activeCount, waiting, skipped, results);
    }

    private IncidentAutoResolutionCheckResult applyDecision(CorrelatedIncident incident, Set<String> active, LocalDateTime now, String actor) {
        IncidentAutoResolutionDecision decision = decide(incident, relevantActiveKeys(incident, active), now, stabilityMinutes, flappingOccurrences);
        IncidentResolutionCheck check = checkRepository.save(IncidentResolutionCheck.builder()
                .incident(incident)
                .status(decision.status())
                .reason(decision.reason())
                .minutesStable(decision.minutesStable())
                .activeSourcePresent(decision.activeSourcePresent())
                .checkedAt(now)
                .build());
        if ("AUTO_RESOLVED".equals(decision.status())) {
            incident.setStatus("RESOLVED");
            incidentRepository.save(incident);
            incidentService.addEvent(incident, "NEXUSIT", "auto-resolution", "INCIDENT_AUTO_RESOLVED", incident.getSeverity(), decision.reason(), Map.of(
                    "minutesStable", decision.minutesStable(),
                    "checkedBy", actor,
                    "stabilityMinutes", stabilityMinutes));
            if (incident.getOpenGlpiTicketId() != null && incident.getOpenGlpiTicketId() > 0) {
                incidentService.addGlpiFollowupSafely(incident.getOpenGlpiTicketId(), "Normalizado automaticamente pelo NexusIT.\n\n" + decision.reason());
            }
        }
        return new IncidentAutoResolutionCheckResult(incident.getId(), incident.getTitle(), CorrelatedIncidentResponse.from(incident), decision, IncidentResolutionCheckResponse.from(check));
    }

    private Set<String> relevantActiveKeys(CorrelatedIncident incident, Set<String> zabbixActive) {
        if ("ZABBIX".equalsIgnoreCase(nvl(incident.getSourceType()))) return zabbixActive;
        return Set.of(nvl(incident.getCorrelationKey())); // non-Zabbix stays ACTIVE until a dedicated source checker is added
    }

    private Set<String> activeZabbixKeys() {
        try {
            return zabbixService.getProblems().stream()
                    .map(p -> CorrelatedIncidentService.zabbixKey(p.hostName(), p.name()))
                    .collect(Collectors.toSet());
        } catch (Exception e) {
            return Set.of("__collection_failed__");
        }
    }

    private static String nvl(String s) { return s == null ? "" : s; }
}
