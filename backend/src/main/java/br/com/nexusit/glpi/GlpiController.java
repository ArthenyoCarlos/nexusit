package br.com.nexusit.glpi;

import lombok.RequiredArgsConstructor;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.util.List;
import java.util.Map;

@RestController
@RequestMapping("/api/glpi")
@RequiredArgsConstructor
public class GlpiController {

    private final GlpiService service;

    @GetMapping("/tickets")
    public List<GlpiTicket> getTickets(
            @RequestParam(required = false) Integer status) {
        return service.getTickets(status);
    }

    @GetMapping("/tickets/{id}")
    public ResponseEntity<GlpiTicketDetail> getTicket(@PathVariable int id) {
        GlpiTicketDetail detail = service.getTicketById(id);
        return detail == null ? ResponseEntity.notFound().build() : ResponseEntity.ok(detail);
    }

    @PostMapping("/tickets/{id}/followup")
    public ResponseEntity<Void> addFollowup(
            @PathVariable int id,
            @RequestBody Map<String, String> body) {
        service.addFollowup(id, body.getOrDefault("content", ""));
        return ResponseEntity.ok().build();
    }

    @PutMapping("/tickets/{id}/close")
    public ResponseEntity<Void> closeTicket(@PathVariable int id) {
        service.closeTicket(id);
        return ResponseEntity.ok().build();
    }

    @PutMapping("/tickets/{id}/assign")
    public ResponseEntity<Void> assignTicket(
            @PathVariable int id,
            @RequestBody Map<String, Integer> body) {
        service.assignTicket(id, body.getOrDefault("userId", 0));
        return ResponseEntity.ok().build();
    }
}
