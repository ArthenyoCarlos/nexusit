package br.com.nexusit.alerts;

import br.com.nexusit.glpi.GlpiService;
import br.com.nexusit.glpi.GlpiTicket;
import br.com.nexusit.hermes.HermesController;
import br.com.nexusit.monitoring.ZabbixProblem;
import br.com.nexusit.monitoring.ZabbixService;
import br.com.nexusit.planning.PlanningTask;
import br.com.nexusit.planning.PlanningTaskRepository;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;

import java.time.LocalDate;
import java.util.List;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.Mockito.lenient;
import static org.mockito.Mockito.when;

@ExtendWith(MockitoExtension.class)
class AlertsServiceTest {

    @Mock HermesController hermesController;
    @Mock GlpiService glpiService;
    @Mock ZabbixService zabbixService;
    @Mock PlanningTaskRepository planningTaskRepo;

    AlertsService service;

    @BeforeEach
    void setUp() {
        service = new AlertsService(hermesController, glpiService, zabbixService, planningTaskRepo);

        lenient().when(hermesController.getSummary()).thenReturn(emptyHermesSummary());
        lenient().when(glpiService.getTickets(null)).thenReturn(List.of());
        lenient().when(zabbixService.getProblems()).thenReturn(List.of());
        lenient().when(planningTaskRepo.findAllWithAssignee()).thenReturn(List.of());
    }

    @Test
    void noAlertsWhenEverythingIsQuiet() {
        AlertsSummary summary = service.getSummary();

        assertThat(summary.items()).isEmpty();
        assertThat(summary.criticalCount()).isZero();
        assertThat(summary.warningCount()).isZero();
    }

    @Test
    void flagsCriticalTicketsAndUnassignedTicketsSeparately() {
        GlpiTicket critical = ticket(1, 6, ""); // prioridade 6 = critica, sem tecnico
        GlpiTicket lowPriorityAssigned = ticket(2, 2, "Ana Técnica");
        when(glpiService.getTickets(null)).thenReturn(List.of(critical, lowPriorityAssigned));

        AlertsSummary summary = service.getSummary();

        assertThat(summary.items())
                .extracting(AlertItem::message)
                .anyMatch(m -> m.contains("crítico"))
                .anyMatch(m -> m.contains("sem técnico"));
        assertThat(summary.criticalCount()).isEqualTo(1);
        assertThat(summary.warningCount()).isEqualTo(1);
    }

    @Test
    void flagsOverdueTasksButNotFutureOrCompletedOnes() {
        PlanningTask overdue = PlanningTask.builder()
                .title("Trocar switch").columnName("Backlog").dueDate(LocalDate.now().minusDays(2)).build();
        PlanningTask futureTask = PlanningTask.builder()
                .title("Renovar licença").columnName("Backlog").dueDate(LocalDate.now().plusDays(5)).build();
        PlanningTask overdueButDone = PlanningTask.builder()
                .title("Já resolvido").columnName("Concluído").dueDate(LocalDate.now().minusDays(10)).build();
        when(planningTaskRepo.findAllWithAssignee()).thenReturn(List.of(overdue, futureTask, overdueButDone));

        AlertsSummary summary = service.getSummary();

        assertThat(summary.items())
                .filteredOn(i -> "planning".equals(i.type()))
                .extracting(AlertItem::message)
                .containsExactly("1 tarefa(s) do planejamento atrasada(s)");
    }

    @Test
    void flagsCriticalZabbixProblems() {
        when(zabbixService.getProblems()).thenReturn(List.of(
                new ZabbixProblem("1", "Disco cheio", 5, "Desastre", "srv-arquivos", 0L),
                new ZabbixProblem("2", "CPU alta", 2, "Aviso", "srv-web", 0L)
        ));

        AlertsSummary summary = service.getSummary();

        assertThat(summary.items())
                .filteredOn(i -> "zabbix".equals(i.type()))
                .hasSize(1)
                .allMatch(i -> "critical".equals(i.severity()));
    }

    private GlpiTicket ticket(int id, int priority, String assignedTo) {
        return new GlpiTicket(id, "Chamado " + id, 1, "Novo", priority, "?", 1, "?", 1, "?",
                "", "Solicitante", assignedTo, "2026-01-01 10:00:00", "", 1, "", "", "", "", 0, "MANUAL");
    }

    private HermesController.HermesSummary emptyHermesSummary() {
        return new HermesController.HermesSummary(100, List.of(), 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0);
    }
}
