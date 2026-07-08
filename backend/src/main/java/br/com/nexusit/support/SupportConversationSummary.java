package br.com.nexusit.support;

import java.time.LocalDateTime;
import java.util.UUID;

public record SupportConversationSummary(
        UUID id,
        String contactPhone,
        String contactName,
        Integer glpiTicketId,
        String state,
        String claimedByName,
        LocalDateTime createdAt,
        LocalDateTime claimedAt
) {
    public static SupportConversationSummary from(SupportConversation c) {
        String contactName = c.getContact().getGlpiUserName() != null && !c.getContact().getGlpiUserName().isBlank()
                ? c.getContact().getGlpiUserName() : c.getContact().getDisplayName();
        return new SupportConversationSummary(
                c.getId(),
                c.getContact().getPhoneNumber(),
                contactName,
                c.getGlpiTicketId(),
                c.getState().name(),
                c.getClaimedBy() != null ? c.getClaimedBy().getName() : null,
                c.getCreatedAt(),
                c.getClaimedAt()
        );
    }
}
