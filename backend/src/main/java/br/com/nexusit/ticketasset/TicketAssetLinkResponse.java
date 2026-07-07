package br.com.nexusit.ticketasset;

import java.time.LocalDateTime;
import java.util.UUID;

public record TicketAssetLinkResponse(
        UUID id,
        Long glpiTicketId,
        TicketAssetType assetType,
        UUID assetId,
        String assetName,
        String assetSubtitle,
        String createdByName,
        LocalDateTime createdAt
) {
    public static TicketAssetLinkResponse from(TicketAssetLink link) {
        var user = link.getCreatedBy();
        return new TicketAssetLinkResponse(
                link.getId(),
                link.getGlpiTicketId(),
                link.getAssetType(),
                link.getAssetId(),
                link.getAssetName(),
                link.getAssetSubtitle(),
                user != null ? user.getName() : null,
                link.getCreatedAt()
        );
    }
}
