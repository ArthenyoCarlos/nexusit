package br.com.nexusit.broadcast;

import br.com.nexusit.user.User;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.*;

import java.util.List;
import java.util.UUID;

@RestController
@RequestMapping("/api/broadcast/rules")
@RequiredArgsConstructor
public class NotificationRuleController {

    private final NotificationRuleService service;

    @GetMapping
    public List<RuleResponse> list() { return service.list(); }

    @PostMapping
    public RuleResponse create(@Valid @RequestBody RuleRequest req, @AuthenticationPrincipal User user) {
        return service.create(req, user);
    }

    @PutMapping("/{id}")
    public RuleResponse update(@PathVariable UUID id, @Valid @RequestBody RuleRequest req) {
        return service.update(id, req);
    }

    @PutMapping("/{id}/active")
    public RuleResponse setActive(@PathVariable UUID id, @RequestBody ActiveRequest req) {
        return service.setActive(id, req.active());
    }

    @DeleteMapping("/{id}")
    public void delete(@PathVariable UUID id) { service.delete(id); }

    @PostMapping("/{id}/trigger")
    public void trigger(@PathVariable UUID id, @AuthenticationPrincipal User user) {
        service.triggerManually(id, user);
    }

    public record ActiveRequest(boolean active) {}
}
