package br.com.nexusit.ticketasset;

import org.springframework.data.jpa.repository.JpaRepository;

import java.util.List;
import java.util.Optional;
import java.util.UUID;

public interface TicketAssetLinkRepository extends JpaRepository<TicketAssetLink, UUID> {
    List<TicketAssetLink> findByGlpiTicketIdOrderByCreatedAtDesc(Long glpiTicketId);
    List<TicketAssetLink> findByAssetTypeAndAssetIdOrderByCreatedAtDesc(TicketAssetType assetType, UUID assetId);
    Optional<TicketAssetLink> findByGlpiTicketIdAndAssetTypeAndAssetId(Long glpiTicketId, TicketAssetType assetType, UUID assetId);
}
