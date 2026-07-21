package br.com.nexusit.cartridge;

import java.time.LocalDateTime;
import java.util.UUID;

public record CartridgeResponse(
        UUID id,
        String code,
        String model,
        String printerModel,
        String status,
        String statusLabel,
        String currentSector,
        LocalDateTime createdAt,
        LocalDateTime updatedAt
) {
    private static final java.util.Map<CartridgeStatus, String> LABELS = java.util.Map.of(
            CartridgeStatus.EM_ESTOQUE, "Em estoque",
            CartridgeStatus.EM_USO, "Em uso",
            CartridgeStatus.EM_MANUTENCAO, "Em manutenção",
            CartridgeStatus.DESCARTADO, "Descartado"
    );

    public static CartridgeResponse from(Cartridge c) {
        return new CartridgeResponse(
                c.getId(), c.getCode(), c.getModel(), c.getPrinterModel(),
                c.getStatus().name(), LABELS.getOrDefault(c.getStatus(), c.getStatus().name()),
                c.getCurrentSector(), c.getCreatedAt(), c.getUpdatedAt()
        );
    }
}
