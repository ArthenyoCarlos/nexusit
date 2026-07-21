package br.com.nexusit.cartridge;

import java.time.LocalDateTime;
import java.util.UUID;

public record CartridgeEventResponse(
        UUID id,
        String type,
        String typeLabel,
        String sector,
        String notes,
        String performedByName,
        LocalDateTime createdAt
) {
    private static final java.util.Map<CartridgeEventType, String> LABELS = java.util.Map.of(
            CartridgeEventType.CADASTRO, "Cadastrado",
            CartridgeEventType.INICIO_MANUTENCAO, "Manutenção iniciada",
            CartridgeEventType.FIM_MANUTENCAO, "Manutenção finalizada",
            CartridgeEventType.DESCARTE, "Descartado"
    );

    public static CartridgeEventResponse from(CartridgeEvent e) {
        return new CartridgeEventResponse(
                e.getId(), e.getType().name(), LABELS.getOrDefault(e.getType(), e.getType().name()),
                e.getSector(), e.getNotes(), e.getPerformedByName(), e.getCreatedAt()
        );
    }
}
