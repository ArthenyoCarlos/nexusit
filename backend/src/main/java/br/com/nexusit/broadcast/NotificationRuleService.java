package br.com.nexusit.broadcast;

import br.com.nexusit.audit.AuditModule;
import br.com.nexusit.audit.AuditService;
import br.com.nexusit.monitoring.ZabbixProblem;
import br.com.nexusit.monitoring.ZabbixService;
import br.com.nexusit.user.User;
import br.com.nexusit.whatsapp.EvolutionApiClient;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.http.HttpStatus;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.server.ResponseStatusException;

import java.time.LocalDateTime;
import java.util.List;
import java.util.Set;
import java.util.UUID;
import java.util.stream.Collectors;

/**
 * "Se o servidor X apresentar problema, disparar mensagem Y para o contato/grupo Z" —
 * rules in MANUAL mode only fire via {@link #triggerManually}; AUTOMATIC ones are picked
 * up here every minute and matched against currently active Zabbix problems, the same
 * polling pattern UrlMonitorService already uses for URL-down alerts.
 */
@Service
@RequiredArgsConstructor
@Slf4j
@Transactional(readOnly = true)
public class NotificationRuleService {

    private final NotificationRuleRepository ruleRepository;
    private final TargetResolver targetResolver;
    private final ZabbixService zabbixService;
    private final EvolutionApiClient evolutionApiClient;
    private final AuditService auditService;

    public List<RuleResponse> list() {
        return ruleRepository.findAllByOrderByNameAsc().stream().map(RuleResponse::from).toList();
    }

    @Transactional
    public RuleResponse create(RuleRequest req, User actor) {
        TargetResolver.Resolved resolved = targetResolver.resolve(req.targetType(), req.targetId());
        NotificationRule rule = NotificationRule.builder()
                .name(req.name())
                .hostId(req.hostId())
                .hostName(req.hostName())
                .message(req.message())
                .targetType(req.targetType())
                .targetId(req.targetId())
                .targetLabel(resolved.label())
                .mode(req.mode())
                .active(true)
                .cooldownMinutes(normalizeCooldown(req.cooldownMinutes()))
                .createdByName(actor != null ? actor.getName() : null)
                .build();
        return RuleResponse.from(ruleRepository.save(rule));
    }

    @Transactional
    public RuleResponse update(UUID id, RuleRequest req) {
        NotificationRule rule = ruleRepository.findById(id)
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "Regra não encontrada"));
        TargetResolver.Resolved resolved = targetResolver.resolve(req.targetType(), req.targetId());
        rule.setName(req.name());
        rule.setHostId(req.hostId());
        rule.setHostName(req.hostName());
        rule.setMessage(req.message());
        rule.setTargetType(req.targetType());
        rule.setTargetId(req.targetId());
        rule.setTargetLabel(resolved.label());
        rule.setMode(req.mode());
        rule.setCooldownMinutes(normalizeCooldown(req.cooldownMinutes()));
        return RuleResponse.from(ruleRepository.save(rule));
    }

    @Transactional
    public RuleResponse setActive(UUID id, boolean active) {
        NotificationRule rule = ruleRepository.findById(id)
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "Regra não encontrada"));
        rule.setActive(active);
        return RuleResponse.from(ruleRepository.save(rule));
    }

    @Transactional
    public void delete(UUID id) {
        ruleRepository.deleteById(id);
    }

    /** Ignores Zabbix state entirely — just sends the rule's saved target+message right now. */
    public void triggerManually(UUID id, User actor) {
        NotificationRule rule = ruleRepository.findById(id)
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "Regra não encontrada"));
        fire(rule, actor, actor != null ? actor.getName() : "Manual", "RULE_MANUAL_SEND", "RULE_MANUAL_FAILED");
    }

    @Scheduled(fixedDelay = 60000)
    public void scheduledCheck() {
        List<NotificationRule> autoRules = ruleRepository.findByModeAndActiveTrue(RuleMode.AUTOMATIC);
        if (autoRules.isEmpty()) return;

        Set<String> hostsWithActiveProblem = zabbixService.getProblems().stream()
                .map(ZabbixProblem::hostId).filter(id -> id != null && !id.isBlank())
                .collect(Collectors.toSet());
        LocalDateTime now = LocalDateTime.now();

        for (NotificationRule rule : autoRules) {
            try {
                if (!hostsWithActiveProblem.contains(rule.getHostId())) continue;
                if (rule.getLastTriggeredAt() != null
                        && rule.getLastTriggeredAt().plusMinutes(rule.getCooldownMinutes()).isAfter(now)) continue;
                fire(rule, null, "Automático (Zabbix)", "RULE_AUTO_SEND", "RULE_AUTO_FAILED");
            } catch (Exception e) {
                log.warn("Falha ao processar regra automática '{}': {}", rule.getName(), e.toString());
            }
        }
    }

    // Deliberately not @Transactional here (see BroadcastService.send for the same reasoning):
    // on failure, the *FAILED audit write must survive even though this method then throws.
    private void fire(NotificationRule rule, User actor, String actorLabel, String successAction, String failAction) {
        TargetResolver.Resolved resolved = targetResolver.resolve(rule.getTargetType(), rule.getTargetId());
        String details = "[" + actorLabel + "] Regra \"" + rule.getName() + "\" (host: "
                + (rule.getHostName() != null ? rule.getHostName() : rule.getHostId()) + "): " + rule.getMessage();
        try {
            evolutionApiClient.sendTextOrThrow(resolved.whatsappTarget(), rule.getMessage());
        } catch (Exception e) {
            log.warn("Falha ao disparar regra '{}': {}", rule.getName(), e.toString());
            auditService.log(AuditModule.BROADCAST, failAction, actor,
                    rule.getTargetType().name(), rule.getTargetId(), resolved.label(), details + "\n\nErro: " + e.getMessage());
            throw new ResponseStatusException(HttpStatus.BAD_GATEWAY, "Falha ao enviar mensagem pelo WhatsApp: " + e.getMessage());
        }
        markTriggered(rule.getId());
        auditService.log(AuditModule.BROADCAST, successAction, actor,
                rule.getTargetType().name(), rule.getTargetId(), resolved.label(), details);
    }

    @Transactional
    void markTriggered(UUID ruleId) {
        ruleRepository.findById(ruleId).ifPresent(r -> { r.setLastTriggeredAt(LocalDateTime.now()); ruleRepository.save(r); });
    }

    private int normalizeCooldown(Integer cooldownMinutes) {
        return cooldownMinutes != null && cooldownMinutes > 0 ? cooldownMinutes : 30;
    }
}
