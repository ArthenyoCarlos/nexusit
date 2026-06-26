package br.com.nexusit.vault;

import br.com.nexusit.user.User;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.*;

import java.util.List;
import java.util.Map;
import java.util.UUID;

@RestController
@RequestMapping("/api/vault")
@RequiredArgsConstructor
@PreAuthorize("hasRole('ADMIN')")
public class CredentialController {

    private final CredentialService service;

    @GetMapping
    public List<CredentialResponse> findAll(
            @RequestParam(required = false) String search,
            @RequestParam(required = false) String type
    ) {
        return service.findAll(search, type);
    }

    @GetMapping("/{id}/reveal")
    public Map<String, String> reveal(@PathVariable UUID id) {
        return Map.of("secret", service.reveal(id));
    }

    @PostMapping
    public ResponseEntity<CredentialResponse> create(
            @Valid @RequestBody CredentialRequest req,
            @AuthenticationPrincipal User user
    ) {
        return ResponseEntity.status(HttpStatus.CREATED).body(service.create(req, user));
    }

    @PutMapping("/{id}")
    public CredentialResponse update(@PathVariable UUID id, @Valid @RequestBody CredentialRequest req) {
        return service.update(id, req);
    }

    @DeleteMapping("/{id}")
    public ResponseEntity<Void> delete(@PathVariable UUID id) {
        service.delete(id);
        return ResponseEntity.noContent().build();
    }
}
