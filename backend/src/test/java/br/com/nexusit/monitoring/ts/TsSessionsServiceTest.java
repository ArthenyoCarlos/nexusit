package br.com.nexusit.monitoring.ts;

import com.fasterxml.jackson.databind.ObjectMapper;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.io.TempDir;

import java.nio.file.Path;
import java.time.Clock;
import java.time.Instant;
import java.time.ZoneOffset;
import java.util.Map;

import static org.assertj.core.api.Assertions.assertThat;

class TsSessionsServiceTest {
    @TempDir Path directory;
    final ObjectMapper mapper = new ObjectMapper();
    final Instant now = Instant.parse("2026-10-27T12:00:00Z");

    TsSessionsService service() {
        return new TsSessionsService(mapper, directory.resolve("snapshot.json").toString(),
                Clock.fixed(now, ZoneOffset.UTC));
    }

    void writeSnapshot(Instant collectedAt, Instant lastSuccessAt, String status) throws Exception {
        java.nio.file.Files.writeString(directory.resolve("snapshot.json"), """
                {"server":"TS-VM","ip":"192.168.2.100","collectedAt":"%s",
                 "lastSuccessAt":"%s","status":"%s","error":"password=secret /private/file",
                 "policy":{"disconnectLimitMinutes":30,"toleranceSeconds":120,"mode":"OBSERVE_ONLY","effectivePolicy":{}},
                 "sessions":[{"id":7,"user":"alice","domain":"CORP","state":"DISCONNECTED",
                   "logonAt":null,"disconnectedAt":null,"disconnectedSeconds":1900,"isAdmin":false,
                   "adminEvidence":"group lookup","clientName":"PC","clientAddress":"192.168.2.8","compliance":"OVERDUE"}],
                 "events":[{"id":"e1","eventId":24,"at":"2026-10-27T11:59:00Z","user":"alice","sessionId":7,"type":"DISCONNECT","source":"WTS"}],
                 "summary":{"total":1,"active":0,"disconnected":1,"overdue":1,"exempt":0,"unknown":0}}
                """.formatted(collectedAt, lastSuccessAt, status));
    }

    @Test
    void validSnapshotPreservesDataAndAddsFreshness() throws Exception {
        writeSnapshot(now.minusSeconds(20), now.minusSeconds(20), "OK");
        Map<String, Object> result = service().getSnapshot();
        assertThat(result).containsEntry("status", "OK").containsEntry("stale", false)
                .containsEntry("collectionAgeSeconds", 20L).containsEntry("complianceCurrent", true)
                .containsEntry("error", null).containsEntry("readOnly", true);
        assertThat((java.util.List<?>) result.get("sessions")).hasSize(1);
        assertThat((java.util.List<?>) result.get("events")).hasSize(1);
        assertThat(((Map<?, ?>) result.get("summary")).get("overdue")).isEqualTo(1);
    }

    @Test
    void staleUsesLastSuccessNotLatestAttemptAndInvalidatesCompliance() throws Exception {
        writeSnapshot(now.minusSeconds(5), now.minusSeconds(181), "OK");
        Map<String, Object> result = service().getSnapshot();
        assertThat(result).containsEntry("status", "STALE").containsEntry("stale", true)
                .containsEntry("collectionAgeSeconds", 181L).containsEntry("complianceCurrent", false);
        assertThat(((Map<?, ?>) ((java.util.List<?>) result.get("sessions")).getFirst()).get("compliance"))
                .isEqualTo("UNKNOWN");
        assertThat(((Map<?, ?>) result.get("summary")).get("overdue")).isNull();
    }

    @org.junit.jupiter.params.ParameterizedTest
    @org.junit.jupiter.params.provider.ValueSource(strings = {"futureCollected", "futureSuccess", "successAfterAttempt", "badJson", "badShape", "badStatus"})
    void unsafeSnapshotsFailClosed(String scenario) throws Exception {
        writeSnapshot(scenario.equals("futureCollected") ? now.plusSeconds(1) : now.minusSeconds(10),
                scenario.equals("futureSuccess") ? now.plusSeconds(1) :
                        scenario.equals("successAfterAttempt") ? now.minusSeconds(5) : now.minusSeconds(10),
                scenario.equals("badStatus") ? "BOGUS" : "OK");
        if (scenario.equals("badJson")) java.nio.file.Files.writeString(directory.resolve("snapshot.json"), "not json");
        if (scenario.equals("badShape")) java.nio.file.Files.writeString(directory.resolve("snapshot.json"),
                "{\"lastSuccessAt\":\"2026-10-27T11:59:50Z\"}");
        assertThat(service().getSnapshot()).containsEntry("status", "UNAVAILABLE")
                .containsEntry("complianceCurrent", false).containsEntry("collectionAgeSeconds", null);
    }

    @org.junit.jupiter.params.ParameterizedTest
    @org.junit.jupiter.params.provider.ValueSource(longs = {20, 181})
    void errorSnapshotNeverClaimsCurrentComplianceOrLeaksCollectorErrors(long age) throws Exception {
        writeSnapshot(now.minusSeconds(5), now.minusSeconds(age), "ERROR");
        Map<String, Object> result = service().getSnapshot();
        assertThat(result).containsEntry("status", "ERROR").containsEntry("stale", age > 180)
                .containsEntry("complianceCurrent", false);
        assertThat(result.get("error").toString()).doesNotContain("secret", "/private/file", "password");
        assertThat(((Map<?, ?>) result.get("summary")).get("overdue")).isNull();
    }

    @org.junit.jupiter.params.ParameterizedTest
    @org.junit.jupiter.params.provider.ValueSource(strings = {"badSession", "badSummary", "badPolicy", "trailingJson", "badEvent", "badSessionTime"})
    void malformedSnapshotContentsAreUnavailable(String scenario) throws Exception {
        writeSnapshot(now.minusSeconds(10), now.minusSeconds(10), "OK");
        var path = directory.resolve("snapshot.json");
        var root = (com.fasterxml.jackson.databind.node.ObjectNode) mapper.readTree(java.nio.file.Files.readString(path));
        switch (scenario) {
            case "badSession" -> ((com.fasterxml.jackson.databind.node.ObjectNode) root.path("sessions").get(0)).put("id", "not-an-int");
            case "badSessionTime" -> ((com.fasterxml.jackson.databind.node.ObjectNode) root.path("sessions").get(0)).put("logonAt", "yesterday");
            case "badSummary" -> ((com.fasterxml.jackson.databind.node.ObjectNode) root.path("summary")).put("total", -1);
            case "badPolicy" -> ((com.fasterxml.jackson.databind.node.ObjectNode) root.path("policy")).put("mode", "LOGOFF");
            case "badEvent" -> ((com.fasterxml.jackson.databind.node.ObjectNode) root.path("events").get(0)).put("at", "yesterday");
        }
        java.nio.file.Files.writeString(path, root.toString() + (scenario.equals("trailingJson") ? " {}" : ""));
        assertThat(service().getSnapshot()).containsEntry("status", "UNAVAILABLE");
    }

    @Test
    void errorBeforeFirstSuccessHasNoAgeAndRemainsError() throws Exception {
        writeSnapshot(now.minusSeconds(5), now.minusSeconds(5), "ERROR");
        var path = directory.resolve("snapshot.json");
        var root = (com.fasterxml.jackson.databind.node.ObjectNode) mapper.readTree(java.nio.file.Files.readString(path));
        root.putNull("lastSuccessAt");
        java.nio.file.Files.writeString(path, root.toString());
        assertThat(service().getSnapshot()).containsEntry("status", "ERROR")
                .containsEntry("stale", true).containsEntry("collectionAgeSeconds", null)
                .containsEntry("complianceCurrent", false);
    }

    @Test
    void exactly180SecondsIsStillFresh() throws Exception {
        writeSnapshot(now.minusSeconds(180), now.minusSeconds(180), "OK");
        assertThat(service().getSnapshot()).containsEntry("stale", false).containsEntry("status", "OK");
    }

    @Test
    void missingSnapshotIsUnavailableNotHealthyZero() {
        Map<String, Object> result = service().getSnapshot();
        assertThat(result).containsEntry("status", "UNAVAILABLE").containsEntry("stale", true)
                .containsEntry("collectionAgeSeconds", null).containsEntry("complianceCurrent", false)
                .containsEntry("readOnly", true);
        assertThat((Map<?, ?>) result.get("summary")).containsValue(null);
        assertThat(result.get("error").toString()).doesNotContain(directory.toString());
    }
}
