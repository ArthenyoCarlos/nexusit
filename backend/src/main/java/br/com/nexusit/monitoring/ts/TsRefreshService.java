package br.com.nexusit.monitoring.ts;

import com.fasterxml.jackson.databind.ObjectMapper;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Service;
import org.springframework.web.server.ResponseStatusException;
import org.springframework.http.HttpStatus;
import java.nio.file.*;
import java.time.Instant;
import java.util.*;

@Service
public class TsRefreshService {
 private final ObjectMapper mapper;
 private final Path state;
 public TsRefreshService(ObjectMapper mapper,@Value("${monitoring.ts.state-path:/home/galdino/.hermes/state}") String state) {
  this.mapper=mapper;this.state=Path.of(state);
 }
 private Map<String,Object> read(String name) {
  try { return mapper.readValue(state.resolve(name).toFile(),new com.fasterxml.jackson.core.type.TypeReference<LinkedHashMap<String,Object>>(){}); }
  catch(Exception e) { return Map.of(); }
 }
 public synchronized Map<String,Object> request() {
  Map<String,Object> current=read("ts_refresh_request.json");
  if(current.get("id") instanceof String id) {
   var existing=status(id);
   if(List.of("QUEUED","RUNNING").contains(existing.get("status")))return existing;
  }
  Map<String,Object> request=Map.of("id",UUID.randomUUID().toString(),"status","QUEUED","requestedAt",Instant.now().toString());
  try {
   Files.createDirectories(state);
   Path temporary=Files.createTempFile(state,"ts-refresh-",".tmp");
   mapper.writeValue(temporary.toFile(),request);
   // Backend container runs as root; host collector must be able to read this non-secret request.
   Files.setPosixFilePermissions(temporary,java.nio.file.attribute.PosixFilePermissions.fromString("rw-r--r--"));
   Files.move(temporary,state.resolve("ts_refresh_request.json"),StandardCopyOption.REPLACE_EXISTING,StandardCopyOption.ATOMIC_MOVE);
   return request;
  } catch(Exception e) { throw new ResponseStatusException(HttpStatus.SERVICE_UNAVAILABLE,"Não foi possível solicitar a coleta TS."); }
 }
 public synchronized Map<String,Object> status(String id) {
  var request=read("ts_refresh_request.json");
  if(!id.equals(request.get("id")))return Map.of("id",id,"status","UNKNOWN");
  var result=read("ts_refresh_result.json");
  if(id.equals(result.get("id")) && List.of("SUCCEEDED","FAILED").contains(result.get("status")))return result;
  try {
   if(Instant.parse((String)request.get("requestedAt")).plusSeconds(100).isBefore(Instant.now()))
    return Map.of("id",id,"status","FAILED","error","Coleta não concluída no prazo. Tente novamente.");
  }catch(Exception e){return Map.of("id",id,"status","FAILED","error","Solicitação de coleta inválida.");}
  return id.equals(result.get("id")) && "RUNNING".equals(result.get("status")) ? result : request;
 }
}
