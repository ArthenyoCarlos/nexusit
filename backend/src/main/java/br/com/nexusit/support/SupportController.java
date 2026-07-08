package br.com.nexusit.support;

import br.com.nexusit.user.User;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.*;

import java.util.List;
import java.util.UUID;

@RestController
@RequestMapping("/api/support")
@RequiredArgsConstructor
public class SupportController {

    private final SupportService service;

    @GetMapping("/queue")
    public List<SupportConversationSummary> getQueue() { return service.getQueue(); }

    @GetMapping("/mine")
    public List<SupportConversationSummary> getMine(@AuthenticationPrincipal User user) { return service.getMine(user); }

    @GetMapping("/{id}")
    public SupportConversationDetail getDetail(@PathVariable UUID id) { return service.getDetail(id); }

    @PostMapping("/{id}/claim")
    public SupportConversationDetail claim(@PathVariable UUID id, @AuthenticationPrincipal User user) {
        return service.claim(id, user);
    }

    @PostMapping("/{id}/reply")
    public SupportConversationDetail reply(@PathVariable UUID id, @Valid @RequestBody ReplyRequest req,
                                            @AuthenticationPrincipal User user) {
        return service.reply(id, user, req.message());
    }

    @PostMapping("/{id}/close")
    public SupportConversationDetail close(@PathVariable UUID id) { return service.close(id); }
}
