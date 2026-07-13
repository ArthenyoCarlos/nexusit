package br.com.nexusit.wiki;

import br.com.nexusit.user.User;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.*;
import java.util.List;
import java.util.UUID;

@RestController @RequestMapping("/api/wiki") @RequiredArgsConstructor
public class WikiController {
    private final WikiService service;

    @GetMapping public List<WikiResponse> list(@RequestParam(required = false) String category) { return service.findAll(category); }
    @GetMapping("/search") public List<WikiResponse> search(@RequestParam String q) { return service.search(q); }
    @GetMapping("/{id}") public WikiResponse get(@PathVariable UUID id) { return service.findById(id); }
    @PostMapping public WikiResponse create(@Valid @RequestBody WikiRequest req, @AuthenticationPrincipal User user) { return service.create(req, user); }
    @PutMapping("/{id}") public WikiResponse update(@PathVariable UUID id, @Valid @RequestBody WikiRequest req) { return service.update(id, req); }
    @DeleteMapping("/{id}") public ResponseEntity<Void> delete(@PathVariable UUID id) { service.delete(id); return ResponseEntity.noContent().build(); }
}
