package br.com.nexusit.sshconsole;

import br.com.nexusit.user.User;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.*;

import java.util.List;
import java.util.UUID;

@RestController
@RequestMapping("/api/ssh-hosts")
@RequiredArgsConstructor
@PreAuthorize("hasRole('ADMIN')")
public class SshHostController {

    private final SshHostService service;

    @GetMapping
    public List<SshHostResponse> findAll() { return service.findAll(); }

    @GetMapping("/{id}")
    public SshHostResponse findById(@PathVariable UUID id) { return service.findById(id); }

    @PostMapping
    public ResponseEntity<SshHostResponse> create(@Valid @RequestBody SshHostRequest req, @AuthenticationPrincipal User user) {
        return ResponseEntity.status(HttpStatus.CREATED).body(service.create(req, user));
    }

    @PutMapping("/{id}")
    public SshHostResponse update(@PathVariable UUID id, @Valid @RequestBody SshHostRequest req) {
        return service.update(id, req);
    }

    @PostMapping("/{id}/reset-host-key")
    public SshHostResponse resetHostKey(@PathVariable UUID id) {
        return service.resetHostKey(id);
    }

    @DeleteMapping("/{id}")
    public ResponseEntity<Void> delete(@PathVariable UUID id) {
        service.delete(id);
        return ResponseEntity.noContent().build();
    }
}
