package br.com.nexusit.glpi;

import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;
import org.springframework.web.client.HttpClientErrorException;

import java.util.List;
import java.util.Map;

@RestController
@RequestMapping("/api/glpi")
@RequiredArgsConstructor
@Slf4j
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

    @GetMapping("/technicians")
    public List<Map<String, Object>> getTechnicians() {
        return service.getTechnicians();
    }

    @PostMapping("/tickets/{id}/followup")
    public ResponseEntity<Map<String, String>> addFollowup(
            @PathVariable int id,
            @RequestBody Map<String, String> body) {
        try {
            service.addFollowup(id, body.getOrDefault("content", ""));
            return ResponseEntity.ok().build();
        } catch (Exception e) {
            log.warn("Failed to add followup to ticket {}: {}", id, describeGlpiError(e));
            return ResponseEntity.status(HttpStatus.BAD_GATEWAY).body(Map.of("error", describeGlpiError(e)));
        }
    }

    @PutMapping("/tickets/{id}/close")
    public ResponseEntity<Map<String, String>> closeTicket(@PathVariable int id) {
        try {
            service.closeTicket(id);
            return ResponseEntity.ok().build();
        } catch (Exception e) {
            log.warn("Failed to close ticket {}: {}", id, describeGlpiError(e));
            return ResponseEntity.status(HttpStatus.BAD_GATEWAY).body(Map.of("error", describeGlpiError(e)));
        }
    }

    @PutMapping("/tickets/{id}/assign")
    public ResponseEntity<Map<String, String>> assignTicket(
            @PathVariable int id,
            @RequestBody Map<String, Integer> body) {
        try {
            service.assignTicket(id, body.getOrDefault("userId", 0));
            return ResponseEntity.ok().build();
        } catch (Exception e) {
            log.warn("Failed to assign technician to ticket {}: {}", id, describeGlpiError(e));
            return ResponseEntity.status(HttpStatus.BAD_GATEWAY).body(Map.of("error", describeGlpiError(e)));
        }
    }

    private String describeGlpiError(Exception e) {
        if (e instanceof HttpClientErrorException httpEx) {
            String responseBody = httpEx.getResponseBodyAsString();
            return responseBody != null && !responseBody.isBlank() ? responseBody : httpEx.getMessage();
        }
        return e.getMessage();
    }
}
