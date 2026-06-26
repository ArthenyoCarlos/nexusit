package br.com.nexusit.mschedule;

import br.com.nexusit.user.User;
import lombok.RequiredArgsConstructor;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.*;
import java.util.List;
import java.util.Map;
import java.util.UUID;

@RestController @RequestMapping("/api/maintenance-schedules") @RequiredArgsConstructor
public class ScheduleController {
    private final ScheduleService service;

    @GetMapping  public List<ScheduleResponse> list() { return service.findAll(); }
    @PostMapping public ScheduleResponse create(@RequestBody ScheduleRequest req, @AuthenticationPrincipal User user) { return service.create(req, user); }
    @PostMapping("/{id}/complete")
    public ScheduleResponse complete(@PathVariable UUID id, @RequestBody(required = false) Map<String,String> body, @AuthenticationPrincipal User user) {
        return service.complete(id, body != null ? body.get("notes") : null, user);
    }
    @DeleteMapping("/{id}") public ResponseEntity<Void> delete(@PathVariable UUID id) { service.delete(id); return ResponseEntity.noContent().build(); }
}
