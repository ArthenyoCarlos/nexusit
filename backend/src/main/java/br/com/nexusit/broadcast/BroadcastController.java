package br.com.nexusit.broadcast;

import br.com.nexusit.audit.AuditEventResponse;
import br.com.nexusit.user.User;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.*;

import java.util.List;
import java.util.UUID;

@RestController
@RequestMapping("/api/broadcast")
@RequiredArgsConstructor
public class BroadcastController {

    private final BroadcastService service;

    @GetMapping("/contacts")
    public List<BroadcastContact> contacts() { return service.listContacts(); }

    @GetMapping("/groups")
    public List<BroadcastGroup> groups() { return service.listGroups(); }

    @GetMapping("/groups/discover")
    public List<DiscoveredGroup> discoverGroups() { return service.discoverGroups(); }

    @PostMapping("/groups")
    public BroadcastGroup saveGroup(@Valid @RequestBody SaveGroupRequest req) { return service.saveGroup(req); }

    @DeleteMapping("/groups/{id}")
    public void deleteGroup(@PathVariable UUID id) { service.deleteGroup(id); }

    @PostMapping("/send")
    public void send(@Valid @RequestBody BroadcastSendRequest req, @AuthenticationPrincipal User user) {
        service.send(req, user);
    }

    @GetMapping("/history")
    public List<AuditEventResponse> history(@RequestParam(defaultValue = "30") int days) {
        return service.history(days);
    }
}
