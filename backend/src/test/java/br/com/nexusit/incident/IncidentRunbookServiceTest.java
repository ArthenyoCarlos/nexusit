package br.com.nexusit.incident;

import org.junit.jupiter.api.Test;

import static org.assertj.core.api.Assertions.assertThat;

class IncidentRunbookServiceTest {

    @Test
    void diskIncidentIncludesSafeReadonlySteps() {
        CorrelatedIncident incident = CorrelatedIncident.builder()
                .id(java.util.UUID.randomUUID())
                .sourceType("ZABBIX")
                .category("ZABBIX_DISK")
                .title("[Zabbix] SRV: filesystem / está cheio")
                .affectedHost("SRV-INTERNO")
                .severity(4)
                .status("OPEN")
                .occurrenceCount(3)
                .summary("Disco acima do limite")
                .recommendation("Validar uso/total/livre")
                .build();

        IncidentRunbookResponse runbook = IncidentRunbookService.buildForIncident(incident);

        assertThat(runbook.recommendedAction()).containsIgnoringCase("disco");
        assertThat(runbook.steps()).extracting(IncidentRunbookStepResponse::actionKey)
                .contains("CHECK_ZABBIX", "CHECK_WIKI", "PING_HOST", "CHECK_PORTS", "GENERATE_CHECKLIST", "DOCUMENT_SOLUTION");
        assertThat(runbook.steps()).allMatch(step -> step.safetyLevel().equals("READ_ONLY") || step.actionKey().equals("DOCUMENT_SOLUTION"));
    }

    @Test
    void unifiIncidentIncludesSwitchPortAndWifiChecks() {
        CorrelatedIncident incident = CorrelatedIncident.builder()
                .id(java.util.UUID.randomUUID())
                .sourceType("UNIFI_AP")
                .category("WIFI_AP_INSTABILITY")
                .title("[UniFi] AP Cozinha instável")
                .affectedHost("AP Cozinha")
                .severity(4)
                .status("OPEN")
                .occurrenceCount(2)
                .summary("Perda e reboots no AP")
                .recommendation("Verificar PoE/switch/cabo")
                .build();

        IncidentRunbookResponse runbook = IncidentRunbookService.buildForIncident(incident);

        assertThat(runbook.recommendedAction()).containsIgnoringCase("AP");
        assertThat(runbook.steps()).extracting(IncidentRunbookStepResponse::actionKey)
                .contains("CHECK_UNIFI", "CHECK_SWITCH_PORT", "CHECK_GLPI", "CREATE_WIKI_DRAFT");
    }
}
