package br.com.nexusit.ticketasset;

import java.util.UUID;

public record TicketAssetLinkRequest(Long glpiTicketId, TicketAssetType assetType, UUID assetId) {}
