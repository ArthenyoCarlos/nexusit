package br.com.nexusit.support;

import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

import java.util.List;
import java.util.Optional;
import java.util.UUID;

public interface SupportConversationTechnicianRepository extends JpaRepository<SupportConversationTechnician, UUID> {

    @Query("SELECT t FROM SupportConversationTechnician t LEFT JOIN FETCH t.user WHERE t.conversation.id = :conversationId " +
            "ORDER BY t.addedAt ASC")
    List<SupportConversationTechnician> findByConversation(@Param("conversationId") UUID conversationId);

    Optional<SupportConversationTechnician> findByConversationIdAndUserId(UUID conversationId, UUID userId);
}
