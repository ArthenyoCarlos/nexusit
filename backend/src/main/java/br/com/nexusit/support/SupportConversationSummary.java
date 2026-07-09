package br.com.nexusit.support;

import java.time.LocalDateTime;
import java.util.List;
import java.util.UUID;

public record SupportConversationSummary(
        UUID id,
        String contactPhone,
        String contactName,
        Integer glpiTicketId,
        String state,
        UUID claimedById,
        String claimedByName,
        List<TechnicianRef> technicians,
        LocalDateTime createdAt,
        LocalDateTime claimedAt,
        LocalDateTime lastMessageAt,
        String lastMessageAuthor,
        String lastMessagePreview
) {
    public record TechnicianRef(UUID id, String name) {}

    public static SupportConversationSummary from(SupportConversation c) {
        return from(c, List.of(), null);
    }

    public static SupportConversationSummary from(SupportConversation c, List<SupportConversationTechnician> extraTechnicians) {
        return from(c, extraTechnicians, null);
    }

    public static SupportConversationSummary from(SupportConversation c, List<SupportConversationTechnician> extraTechnicians, SupportMessage lastMessage) {
        String contactName = c.getContact().getGlpiUserName() != null && !c.getContact().getGlpiUserName().isBlank()
                ? c.getContact().getGlpiUserName() : c.getContact().getDisplayName();
        String preview = lastMessage == null ? null : lastMessage.getContent();
        return new SupportConversationSummary(
                c.getId(),
                c.getContact().getPhoneNumber(),
                contactName,
                c.getGlpiTicketId(),
                c.getState().name(),
                c.getClaimedBy() != null ? c.getClaimedBy().getId() : null,
                c.getClaimedBy() != null ? c.getClaimedBy().getName() : null,
                extraTechnicians.stream().map(t -> new TechnicianRef(t.getUser().getId(), t.getUser().getName())).toList(),
                c.getCreatedAt(),
                c.getClaimedAt(),
                lastMessage != null ? lastMessage.getCreatedAt() : null,
                lastMessage != null ? lastMessage.getAuthor().name() : null,
                (preview != null && preview.length() > 140) ? preview.substring(0, 140) + "…" : preview
        );
    }
}
