package br.com.nexusit.support;

import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

import java.util.List;
import java.util.Optional;
import java.util.UUID;

public interface SupportMessageRepository extends JpaRepository<SupportMessage, UUID> {

    @Query("SELECT m FROM SupportMessage m WHERE m.conversation.id = :conversationId ORDER BY m.createdAt ASC")
    List<SupportMessage> findByConversation(@Param("conversationId") UUID conversationId);

    Optional<SupportMessage> findFirstByConversationIdOrderByCreatedAtDesc(UUID conversationId);
}
