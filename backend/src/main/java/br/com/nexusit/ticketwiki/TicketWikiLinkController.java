package br.com.nexusit.ticketwiki;

import br.com.nexusit.user.User;
import lombok.RequiredArgsConstructor;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.*;

import java.util.List;

@RestController
@RequestMapping("/api/ticket-wiki-links")
@RequiredArgsConstructor
public class TicketWikiLinkController {
    private final TicketWikiLinkService service;

    @PostMapping
    public TicketWikiLinkResponse create(@RequestBody TicketWikiLinkRequest req, @AuthenticationPrincipal User user) {
        return service.create(req, user);
    }

    @GetMapping("/glpi/{glpiTicketId}")
    public List<TicketWikiLinkResponse> byTicket(@PathVariable Long glpiTicketId) {
        return service.findByTicket(glpiTicketId);
    }
}
