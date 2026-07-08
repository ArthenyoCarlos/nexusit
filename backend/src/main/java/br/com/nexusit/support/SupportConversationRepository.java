package br.com.nexusit.support;

import br.com.nexusit.user.User;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Modifying;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import org.springframework.transaction.annotation.Transactional;

import java.time.LocalDateTime;
import java.util.List;
import java.util.Optional;
import java.util.UUID;

public interface SupportConversationRepository extends JpaRepository<SupportConversation, UUID> {

    @Query("SELECT c FROM SupportConversation c WHERE c.contact.id = :contactId AND c.state <> 'CLOSED' " +
            "ORDER BY c.createdAt DESC")
    List<SupportConversation> findOpenByContact(@Param("contactId") UUID contactId);

    default Optional<SupportConversation> findLatestOpenByContact(UUID contactId) {
        List<SupportConversation> open = findOpenByContact(contactId);
        return open.isEmpty() ? Optional.empty() : Optional.of(open.get(0));
    }

    @Query("SELECT c FROM SupportConversation c LEFT JOIN FETCH c.contact WHERE c.state = 'PENDING_TECH' " +
            "ORDER BY c.createdAt ASC")
    List<SupportConversation> findQueue();

    @Query("SELECT c FROM SupportConversation c LEFT JOIN FETCH c.contact WHERE c.state = 'HUMAN_ACTIVE' " +
            "AND c.claimedBy.id = :userId ORDER BY c.claimedAt DESC")
    List<SupportConversation> findMine(@Param("userId") UUID userId);

    @Query("SELECT c FROM SupportConversation c LEFT JOIN FETCH c.contact LEFT JOIN FETCH c.claimedBy WHERE c.id = :id")
    Optional<SupportConversation> findByIdWithContact(@Param("id") UUID id);

    @Modifying
    @Transactional
    @Query("UPDATE SupportConversation c SET c.claimedBy = :user, c.state = 'HUMAN_ACTIVE', c.claimedAt = :now " +
            "WHERE c.id = :id AND c.claimedBy IS NULL AND c.state = 'PENDING_TECH'")
    int claim(@Param("id") UUID id, @Param("user") User user, @Param("now") LocalDateTime now);
}
