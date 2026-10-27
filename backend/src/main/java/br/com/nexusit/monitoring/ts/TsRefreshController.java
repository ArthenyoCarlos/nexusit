package br.com.nexusit.monitoring.ts;

import org.springframework.http.CacheControl;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.web.bind.annotation.*;
import java.util.Map;

@RestController
@PreAuthorize("isAuthenticated()")
@RequestMapping("/api/monitoring/ts-sessions/refresh")
public class TsRefreshController {
 private final TsRefreshService service;
 public TsRefreshController(TsRefreshService service){this.service=service;}
 @PostMapping public ResponseEntity<Map<String,Object>> request(){return ResponseEntity.accepted().cacheControl(CacheControl.noStore()).body(service.request());}
 @GetMapping("/{id}") public ResponseEntity<Map<String,Object>> status(@PathVariable String id){return ResponseEntity.ok().cacheControl(CacheControl.noStore()).body(service.status(id));}
}
