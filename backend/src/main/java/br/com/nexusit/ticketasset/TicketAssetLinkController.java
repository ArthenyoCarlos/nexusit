package br.com.nexusit.ticketasset;

import br.com.nexusit.user.User;
import lombok.RequiredArgsConstructor;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.*;

import java.util.List;
import java.util.UUID;

@RestController
@RequestMapping("/api/ticket-asset-links")
@RequiredArgsConstructor
public class TicketAssetLinkController {
    private final TicketAssetLinkService service;

    @PostMapping
    public TicketAssetLinkResponse create(@RequestBody TicketAssetLinkRequest req, @AuthenticationPrincipal User user) {
        return service.create(req, user);
    }

    @GetMapping("/glpi/{glpiTicketId}")
    public List<TicketAssetLinkResponse> byTicket(@PathVariable Long glpiTicketId) {
        return service.findByTicket(glpiTicketId);
    }

    @GetMapping("/asset/{assetType}/{assetId}")
    public List<TicketAssetLinkResponse> byAsset(@PathVariable TicketAssetType assetType, @PathVariable UUID assetId) {
        return service.findByAsset(assetType, assetId);
    }

    @DeleteMapping("/{id}")
    public ResponseEntity<Void> delete(@PathVariable UUID id) {
        service.delete(id);
        return ResponseEntity.noContent().build();
    }
}
