package br.com.nexusit.ticketasset;

import br.com.nexusit.inventory.InventoryRepository;
import br.com.nexusit.system.SystemRepository;
import br.com.nexusit.user.User;
import jakarta.persistence.EntityNotFoundException;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;

import java.util.List;
import java.util.UUID;

@Service
@RequiredArgsConstructor
public class TicketAssetLinkService {

    private final TicketAssetLinkRepository repo;
    private final SystemRepository systemRepo;
    private final InventoryRepository inventoryRepo;

    public TicketAssetLinkResponse create(TicketAssetLinkRequest req, User user) {
        if (req.glpiTicketId() == null || req.glpiTicketId() <= 0)
            throw new IllegalArgumentException("glpiTicketId inválido");
        if (req.assetType() == null || req.assetId() == null)
            throw new IllegalArgumentException("assetType e assetId são obrigatórios");

        var existing = repo.findByGlpiTicketIdAndAssetTypeAndAssetId(req.glpiTicketId(), req.assetType(), req.assetId());
        if (existing.isPresent()) return TicketAssetLinkResponse.from(existing.get());

        String name;
        String subtitle;
        if (req.assetType() == TicketAssetType.SYSTEM) {
            var system = systemRepo.findById(req.assetId())
                    .orElseThrow(() -> new EntityNotFoundException("Sistema não encontrado"));
            name = system.getName();
            subtitle = system.getCategory() != null ? system.getCategory().name() : null;
        } else {
            var item = inventoryRepo.findById(req.assetId())
                    .orElseThrow(() -> new EntityNotFoundException("Ativo do inventário não encontrado"));
            name = item.getName();
            subtitle = item.getType() != null ? item.getType().name() : null;
        }

        var link = TicketAssetLink.builder()
                .glpiTicketId(req.glpiTicketId())
                .assetType(req.assetType())
                .assetId(req.assetId())
                .assetName(name)
                .assetSubtitle(subtitle)
                .createdBy(user)
                .build();
        return TicketAssetLinkResponse.from(repo.save(link));
    }

    public List<TicketAssetLinkResponse> findByTicket(Long glpiTicketId) {
        if (glpiTicketId == null || glpiTicketId <= 0) return List.of();
        return repo.findByGlpiTicketIdOrderByCreatedAtDesc(glpiTicketId).stream()
                .map(TicketAssetLinkResponse::from)
                .toList();
    }

    public List<TicketAssetLinkResponse> findByAsset(TicketAssetType assetType, UUID assetId) {
        if (assetType == null || assetId == null) return List.of();
        return repo.findByAssetTypeAndAssetIdOrderByCreatedAtDesc(assetType, assetId).stream()
                .map(TicketAssetLinkResponse::from)
                .toList();
    }

    public void delete(UUID id) {
        if (!repo.existsById(id)) throw new EntityNotFoundException("Vínculo não encontrado");
        repo.deleteById(id);
    }
}
