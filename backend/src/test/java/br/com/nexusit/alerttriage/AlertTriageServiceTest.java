package br.com.nexusit.alerttriage;

import br.com.nexusit.glpi.GlpiClient;
import br.com.nexusit.incident.CorrelatedIncidentService;
import br.com.nexusit.monitoring.ZabbixProblem;
import br.com.nexusit.monitoring.ZabbixService;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.ArgumentCaptor;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;

import java.time.LocalDateTime;
import java.util.List;
import java.util.Optional;
import java.util.UUID;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.Mockito.*;

@ExtendWith(MockitoExtension.class)
class AlertTriageServiceTest {
    @Mock AlertTriageRuleRepository repository;
    @Mock ZabbixService zabbixService;
    @Mock GlpiClient glpiClient;
    @Mock CorrelatedIncidentService incidentService;

    AlertTriageService service;
    ZabbixProblem problem;

    @BeforeEach
    void setUp() {
        service = new AlertTriageService(repository, zabbixService, glpiClient, incidentService);
        problem = new ZabbixProblem("432", "Kerio: Interface VPN BCSJ >> BCCZ (tunnel 3) está DOWN", 2, "Warning", "Kerio Control", 1_721_805_060L, "10084");
        lenient().when(zabbixService.getProblems()).thenReturn(List.of(problem));
    }

    @Test
    void decideReusesExistingInactiveRuleInsteadOfCreatingDuplicate() {
        UUID existingId = UUID.randomUUID();
        AlertTriageRule existing = AlertTriageRule.builder()
                .id(existingId)
                .hostPattern(problem.hostName())
                .alertPattern(problem.name())
                .severityMin(problem.severity())
                .severityMax(problem.severity())
                .action(AlertTriageAction.IGNORE)
                .reason("motivo antigo")
                .enabled(false)
                .createdAt(LocalDateTime.now().minusDays(1))
                .updatedAt(LocalDateTime.now().minusDays(1))
                .build();
        when(repository.findReusableDecisionRule(problem.hostName(), problem.name(), problem.severity(), problem.severity(), AlertTriageAction.IGNORE))
                .thenReturn(Optional.of(existing));
        when(repository.save(any(AlertTriageRule.class))).thenAnswer(inv -> inv.getArgument(0));

        AlertTriageRuleResponse response = service.decide(
                new AlertTriageDecisionRequest(problem.id(), AlertTriageAction.IGNORE, "Descartado pela triagem NexusIT", null, null, null, null),
                null);

        ArgumentCaptor<AlertTriageRule> saved = ArgumentCaptor.forClass(AlertTriageRule.class);
        verify(repository).save(saved.capture());
        assertThat(response.id()).isEqualTo(existingId);
        assertThat(saved.getValue().getId()).isEqualTo(existingId);
        assertThat(saved.getValue().isEnabled()).isTrue();
        assertThat(saved.getValue().getReason()).isEqualTo("Descartado pela triagem NexusIT");
    }
}
