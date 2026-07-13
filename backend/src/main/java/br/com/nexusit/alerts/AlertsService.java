package br.com.nexusit.alerts;

import br.com.nexusit.glpi.GlpiService;
import br.com.nexusit.glpi.GlpiTicket;
import br.com.nexusit.hermes.HermesController;
import br.com.nexusit.monitoring.ZabbixProblem;
import br.com.nexusit.monitoring.ZabbixService;
import br.com.nexusit.planning.PlanningTaskRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;

import java.time.LocalDate;
import java.util.ArrayList;
import java.util.List;

@Service
@RequiredArgsConstructor
public class AlertsService {

    private final HermesController hermesController;
    private final GlpiService glpiService;
    private final ZabbixService zabbixService;
    private final PlanningTaskRepository planningTaskRepo;

    public AlertsSummary getSummary() {
        List<AlertItem> items = new ArrayList<>();

        hermesController.getSummary().attentionItems().forEach(a ->
                items.add(new AlertItem(a.type(), a.severity(), a.message(), a.path())));

        // GLPI: getTickets(null) já retorna só chamados em aberto (status 1-4),
        // com técnico/solicitante resolvidos em lote (ver GlpiService.fetchActorMaps)
        List<GlpiTicket> tickets = glpiService.getTickets(null);
        long criticalTickets = tickets.stream().filter(t -> t.priority() >= 4).count();
        long unassignedTickets = tickets.stream()
                .filter(t -> t.assignedTo() == null || t.assignedTo().isBlank()).count();
        if (criticalTickets > 0)
            items.add(new AlertItem("ticket", "critical",
                    criticalTickets + " chamado(s) crítico(s) em aberto", "/tickets"));
        if (unassignedTickets > 0)
            items.add(new AlertItem("ticket", "warning",
                    unassignedTickets + " chamado(s) sem técnico", "/tickets"));

        // Zabbix: problemas ativos com severidade alta/desastre
        List<ZabbixProblem> problems = zabbixService.getProblems();
        long criticalProblems = problems.stream().filter(p -> p.severity() >= 4).count();
        if (criticalProblems > 0)
            items.add(new AlertItem("zabbix", "critical",
                    criticalProblems + " problema(s) crítico(s) no monitoramento", "/monitoring"));

        // Planejamento: tarefas com prazo vencido fora da coluna "Concluído"
        LocalDate today = LocalDate.now();
        long overdueTasks = planningTaskRepo.findAllWithAssignee().stream()
                .filter(t -> t.getDueDate() != null && t.getDueDate().isBefore(today)
                        && !"Concluído".equals(t.getColumnName()))
                .count();
        if (overdueTasks > 0)
            items.add(new AlertItem("planning", "warning",
                    overdueTasks + " tarefa(s) do planejamento atrasada(s)", "/planning"));

        int criticalCount = (int) items.stream().filter(i -> "critical".equals(i.severity())).count();
        int warningCount = (int) items.stream().filter(i -> "warning".equals(i.severity())).count();

        return new AlertsSummary(criticalCount, warningCount, items);
    }
}
