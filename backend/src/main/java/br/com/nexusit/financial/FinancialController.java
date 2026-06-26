package br.com.nexusit.financial;

import br.com.nexusit.user.User;
import lombok.RequiredArgsConstructor;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.*;
import java.util.List;
import java.util.Map;
import java.util.UUID;

@RestController @RequestMapping("/api/financial") @RequiredArgsConstructor
public class FinancialController {
    private final FinancialService service;

    @GetMapping("/summary") public Map<String, Object> summary() { return service.summary(); }
    @GetMapping("/bills")   public List<BillResponse> list() { return service.findAll(); }
    @GetMapping("/bills/pending") public List<BillResponse> pending() { return service.findPending(); }
    @PostMapping("/bills")  public BillResponse create(@RequestBody BillRequest req, @AuthenticationPrincipal User user) { return service.create(req, user); }
    @PutMapping("/bills/{id}") public BillResponse update(@PathVariable UUID id, @RequestBody BillRequest req) { return service.update(id, req); }
    @PatchMapping("/bills/{id}/pay") public BillResponse pay(@PathVariable UUID id) { return service.markPaid(id); }
    @DeleteMapping("/bills/{id}") public ResponseEntity<Void> delete(@PathVariable UUID id) { service.delete(id); return ResponseEntity.noContent().build(); }
}
