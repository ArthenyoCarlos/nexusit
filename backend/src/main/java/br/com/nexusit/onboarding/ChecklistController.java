package br.com.nexusit.onboarding;

import br.com.nexusit.user.User;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.*;

import java.util.List;
import java.util.UUID;

@RestController
@RequestMapping("/api/onboarding")
@RequiredArgsConstructor
public class ChecklistController {

    private final ChecklistService service;

    @GetMapping
    public List<ChecklistResponse> findAll(@RequestParam(required = false) String type) {
        return service.findAll(type);
    }

    @GetMapping("/{id}")
    public ChecklistResponse findById(@PathVariable UUID id) { return service.findById(id); }

    @PostMapping
    public ResponseEntity<ChecklistResponse> create(
            @Valid @RequestBody ChecklistRequest req,
            @AuthenticationPrincipal User user
    ) {
        return ResponseEntity.status(HttpStatus.CREATED).body(service.create(req, user));
    }

    @PatchMapping("/{checklistId}/items/{itemId}/toggle")
    public ChecklistResponse toggleItem(
            @PathVariable UUID checklistId,
            @PathVariable UUID itemId,
            @AuthenticationPrincipal User user
    ) {
        return service.toggleItem(checklistId, itemId, user);
    }

    @DeleteMapping("/{id}")
    public ResponseEntity<Void> delete(@PathVariable UUID id) {
        service.delete(id);
        return ResponseEntity.noContent().build();
    }
}
