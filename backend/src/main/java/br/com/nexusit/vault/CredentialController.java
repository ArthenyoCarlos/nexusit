package br.com.nexusit.vault;

import br.com.nexusit.user.User;
import br.com.nexusit.vault.bitwarden.VaultwardenCipherSummary;
import br.com.nexusit.vault.bitwarden.VaultwardenReadService;
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
    private final VaultwardenReadService vaultwardenReadService;

    @GetMapping("/vaultwarden")
    public List<VaultwardenCipherSummary> findVaultwardenItems() {
        return vaultwardenReadService.listOrganizationLogins();
    }

    @GetMapping("/vaultwarden/{id}/reveal")
    public Map<String, String> revealVaultwardenItem(@PathVariable String id, @AuthenticationPrincipal User user) {
        return Map.of("secret", vaultwardenReadService.revealPassword(id, user));
    }

    @GetMapping
    public List<CredentialResponse> findAll(
            @RequestParam(required = false) String search,
            @RequestParam(required = false) String type
    ) {
        return service.findAll(search, type);
    }

    @GetMapping("/{id}/reveal")
    public Map<String, String> reveal(@PathVariable UUID id, @AuthenticationPrincipal User user) {
        return Map.of("secret", service.reveal(id, user));
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
