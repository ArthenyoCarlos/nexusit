package br.com.nexusit.support;

import br.com.nexusit.user.User;
import jakarta.persistence.*;
import lombok.*;

import java.time.LocalDateTime;
import java.util.UUID;

@Entity
@Table(name = "support_conversations")
@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class SupportConversation {

    @Id
    @GeneratedValue(strategy = GenerationType.UUID)
    private UUID id;

    @ManyToOne(fetch = FetchType.LAZY, optional = false)
    @JoinColumn(name = "contact_id", nullable = false)
    private WhatsappContact contact;

    @Enumerated(EnumType.STRING)
    @Column(nullable = false, length = 24)
    @Builder.Default
    private ConversationState state = ConversationState.AWAITING_NAME;

    @Column(name = "glpi_ticket_id")
    private Integer glpiTicketId;

    @ManyToOne(fetch = FetchType.LAZY, optional = true)
    @JoinColumn(name = "claimed_by")
    private User claimedBy;

    @Column(name = "created_at", nullable = false, updatable = false)
    private LocalDateTime createdAt;

    @Column(name = "claimed_at")
    private LocalDateTime claimedAt;

    @Column(name = "closed_at")
    private LocalDateTime closedAt;

    @PrePersist
    void prePersist() { if (createdAt == null) createdAt = LocalDateTime.now(); }
}
