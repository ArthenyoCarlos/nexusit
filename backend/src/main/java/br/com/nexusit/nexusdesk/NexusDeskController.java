package br.com.nexusit.nexusdesk;

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
@RequestMapping("/api/nexusdesk")
@RequiredArgsConstructor
@PreAuthorize("hasRole('ADMIN')")
public class NexusDeskController {

    private final NexusDeskService service;

    @GetMapping("/devices")
    public List<NexusDeskDeviceResponse> findAll() { return service.findAll(); }

    @PostMapping("/devices")
    public ResponseEntity<NexusDeskDeviceResponse> create(@Valid @RequestBody NexusDeskDeviceRequest req,
                                                            @AuthenticationPrincipal User user) {
        return ResponseEntity.status(HttpStatus.CREATED).body(service.create(req, user));
    }

    @PutMapping("/devices/{id}")
    public NexusDeskDeviceResponse update(@PathVariable UUID id, @Valid @RequestBody NexusDeskDeviceRequest req) {
        return service.update(id, req);
    }

    @DeleteMapping("/devices/{id}")
    public ResponseEntity<Void> delete(@PathVariable UUID id) {
        service.delete(id);
        return ResponseEntity.noContent().build();
    }

    @PostMapping("/devices/{id}/connect")
    public NexusDeskConnectResponse connect(@PathVariable UUID id,
                                             @RequestParam(required = false) Integer ticketId,
                                             @AuthenticationPrincipal User user) {
        return service.connect(id, ticketId, user);
    }

    @GetMapping("/sessions")
    public List<NexusDeskSessionResponse> findSessions() { return service.findSessions(); }
}
