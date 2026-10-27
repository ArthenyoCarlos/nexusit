package br.com.nexusit.monitoring.ts;

import com.fasterxml.jackson.databind.ObjectMapper;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.io.TempDir;
import java.nio.file.Path;
import java.nio.file.Files;
import java.util.Map;
import static org.assertj.core.api.Assertions.assertThat;

class TsRefreshServiceTest {
 @TempDir Path directory;
 ObjectMapper mapper=new ObjectMapper();
 @Test void queuesRealRequestAndCoalescesRepeatedClicks() throws Exception {
  var service=new TsRefreshService(mapper,directory.toString());
  Map<String,Object> first=service.request();
  assertThat(first).containsEntry("status","QUEUED");
  assertThat(service.request().get("id")).isEqualTo(first.get("id"));
  assertThat(Files.exists(directory.resolve("ts_refresh_request.json"))).isTrue();
 }
 @Test void returnsWorkerResultAndDoesNotTreatUnknownIdAsSuccess() throws Exception {
  var service=new TsRefreshService(mapper,directory.toString());
  var request=service.request();String id=(String)request.get("id");
  mapper.writeValue(directory.resolve("ts_refresh_result.json").toFile(),Map.of("id",id,"status","SUCCEEDED","collectedAt","2026-10-27T10:00:00Z"));
  assertThat(service.status(id)).containsEntry("status","SUCCEEDED");
  assertThat(service.status("unknown")).containsEntry("status","UNKNOWN");
  assertThat(service.request().get("id")).isNotEqualTo(id);
 }
 @Test void expiresPendingRequestWhenWorkerUnavailable() throws Exception {
  var service=new TsRefreshService(mapper,directory.toString());
  String id="f0871dee-97f9-4e8a-a0a3-7432ca42d556";
  mapper.writeValue(directory.resolve("ts_refresh_request.json").toFile(),Map.of("id",id,"requestedAt","2020-01-01T00:00:00Z","status","QUEUED"));
  assertThat(service.status(id)).containsEntry("status","FAILED");
 }
}
