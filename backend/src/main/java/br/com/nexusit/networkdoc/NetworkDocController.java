package br.com.nexusit.networkdoc;

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
@RequestMapping("/api/network-docs")
@RequiredArgsConstructor
public class NetworkDocController {

    private final NetworkDocService service;

    @GetMapping
    public List<NetworkDocResponse> findAll(@RequestParam(required = false) String section) {
        return section != null ? service.findBySection(section) : service.findAll();
    }

    @PostMapping
    public ResponseEntity<NetworkDocResponse> create(
            @Valid @RequestBody NetworkDocRequest req,
            @AuthenticationPrincipal User user
    ) {
        return ResponseEntity.status(HttpStatus.CREATED).body(service.create(req, user));
    }

    @PutMapping("/{id}")
    public NetworkDocResponse update(
            @PathVariable UUID id,
            @Valid @RequestBody NetworkDocRequest req,
            @AuthenticationPrincipal User user
    ) {
        return service.update(id, req, user);
    }

    @DeleteMapping("/{id}")
    @PreAuthorize("hasRole('ADMIN')")
    public ResponseEntity<Void> delete(@PathVariable UUID id) {
        service.delete(id);
        return ResponseEntity.noContent().build();
    }
}
