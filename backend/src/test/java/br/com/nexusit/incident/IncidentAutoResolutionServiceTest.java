package br.com.nexusit.incident;

import org.junit.jupiter.api.Test;

import java.time.LocalDateTime;
import java.util.Set;

import static org.assertj.core.api.Assertions.assertThat;

class IncidentAutoResolutionServiceTest {

    @Test
    void resolvesWhenOpenIncidentIsAbsentFromActiveSourcesAndStableLongEnough() {
        CorrelatedIncident incident = CorrelatedIncident.builder()
                .correlationKey("zabbix:kerio:wan-down")
                .sourceType("ZABBIX")
                .status("OPEN")
                .severity(4)
                .occurrenceCount(1)
                .lastSeenAt(LocalDateTime.parse("2026-07-26T10:00:00"))
                .build();

        IncidentAutoResolutionDecision decision = IncidentAutoResolutionService.decide(
                incident,
                Set.of(),
                LocalDateTime.parse("2026-07-26T10:20:00"),
                15,
                3
        );

        assertThat(decision.status()).isEqualTo("AUTO_RESOLVED");
        assertThat(decision.minutesStable()).isEqualTo(20);
        assertThat(decision.reason()).contains("20 minutos");
    }

    @Test
    void waitsWhenIncidentIsAbsentButStillInsideStabilityWindow() {
        CorrelatedIncident incident = CorrelatedIncident.builder()
                .correlationKey("zabbix:kerio:wan-down")
                .sourceType("ZABBIX")
                .status("OPEN")
                .severity(4)
                .occurrenceCount(1)
                .lastSeenAt(LocalDateTime.parse("2026-07-26T10:10:00"))
                .build();

        IncidentAutoResolutionDecision decision = IncidentAutoResolutionService.decide(
                incident,
                Set.of(),
                LocalDateTime.parse("2026-07-26T10:20:00"),
                15,
                3
        );

        assertThat(decision.status()).isEqualTo("WAITING_STABILITY");
        assertThat(decision.minutesStable()).isEqualTo(10);
    }

    @Test
    void doesNotResolveWhenSourceStillActive() {
        CorrelatedIncident incident = CorrelatedIncident.builder()
                .correlationKey("zabbix:kerio:wan-down")
                .sourceType("ZABBIX")
                .status("OPEN")
                .severity(4)
                .occurrenceCount(1)
                .lastSeenAt(LocalDateTime.parse("2026-07-26T10:00:00"))
                .build();

        IncidentAutoResolutionDecision decision = IncidentAutoResolutionService.decide(
                incident,
                Set.of("zabbix:kerio:wan-down"),
                LocalDateTime.parse("2026-07-26T10:30:00"),
                15,
                3
        );

        assertThat(decision.status()).isEqualTo("ACTIVE");
    }

    @Test
    void skipsFlappingCriticalIncidentsWithManyOccurrences() {
        CorrelatedIncident incident = CorrelatedIncident.builder()
                .correlationKey("zabbix:wan:flapping")
                .sourceType("ZABBIX")
                .status("OPEN")
                .severity(5)
                .occurrenceCount(5)
                .lastSeenAt(LocalDateTime.parse("2026-07-26T10:00:00"))
                .build();

        IncidentAutoResolutionDecision decision = IncidentAutoResolutionService.decide(
                incident,
                Set.of(),
                LocalDateTime.parse("2026-07-26T10:45:00"),
                15,
                3
        );

        assertThat(decision.status()).isEqualTo("SKIPPED_FLAPPING");
        assertThat(decision.reason()).contains("oscilação");
    }
}
