package br.com.nexusit.contracts;

import br.com.nexusit.user.User;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.*;
import java.util.List;
import java.util.UUID;

@RestController @RequestMapping("/api/contracts") @RequiredArgsConstructor
public class ContractController {
    private final ContractService service;

    @GetMapping  public List<ContractResponse> list() { return service.findAll(); }
    @PostMapping public ContractResponse create(@Valid @RequestBody ContractRequest req, @AuthenticationPrincipal User user) { return service.create(req, user); }
    @PutMapping("/{id}") public ContractResponse update(@PathVariable UUID id, @Valid @RequestBody ContractRequest req) { return service.update(id, req); }
    @DeleteMapping("/{id}") public ResponseEntity<Void> delete(@PathVariable UUID id) { service.delete(id); return ResponseEntity.noContent().build(); }
}
