package br.com.nexusit.support;

import br.com.nexusit.glpi.GlpiService;
import br.com.nexusit.user.User;
import br.com.nexusit.whatsapp.EvolutionApiClient;
import jakarta.persistence.EntityNotFoundException;
import lombok.RequiredArgsConstructor;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.server.ResponseStatusException;

import java.time.LocalDateTime;
import java.util.List;
import java.util.UUID;

@Service
@RequiredArgsConstructor
@Transactional(readOnly = true)
public class SupportService {

    private final SupportConversationRepository conversationRepo;
    private final SupportMessageRepository messageRepo;
    private final GlpiService glpiService;
    private final EvolutionApiClient evolutionApiClient;
    private final BotAtendimentoTiStateStore stateStore;

    public List<SupportConversationSummary> getQueue() {
        return conversationRepo.findQueue().stream().map(SupportConversationSummary::from).toList();
    }

    public List<SupportConversationSummary> getMine(User user) {
        return conversationRepo.findMine(user.getId()).stream().map(SupportConversationSummary::from).toList();
    }

    public SupportConversationDetail getDetail(UUID id) {
        SupportConversation conversation = getOrThrow(id);
        List<SupportMessageResponse> messages = messageRepo.findByConversation(id).stream()
                .map(SupportMessageResponse::from).toList();
        return new SupportConversationDetail(SupportConversationSummary.from(conversation), messages);
    }

    public SupportMessageMedia getMessageMedia(UUID messageId) {
        SupportMessage message = messageRepo.findById(messageId)
                .orElseThrow(() -> new EntityNotFoundException("Mensagem não encontrada"));
        if (message.getMediaBytes() == null || message.getMediaBytes().length == 0) {
            throw new ResponseStatusException(HttpStatus.NOT_FOUND, "Mensagem sem mídia");
        }
        return new SupportMessageMedia(message.getMediaBytes(), message.getMediaFilename(), message.getMediaMime());
    }

    @Transactional
    public SupportConversationDetail claim(UUID id, User user) {
        int updated = conversationRepo.claim(id, user, LocalDateTime.now());
        if (updated == 0) {
            throw new ResponseStatusException(HttpStatus.CONFLICT, "Este atendimento já foi assumido por outro técnico");
        }
        SupportConversation conversation = getOrThrow(id);
        String text = "👨‍💻 O técnico " + user.getName() + " irá atendê-lo agora. A partir deste momento, você está em atendimento direto.";
        recordMessage(conversation, MessageDirection.OUT, MessageAuthor.HERMES, "Hermes", text);
        evolutionApiClient.sendText(conversation.getContact().getPhoneNumber(), text);
        stateStore.save(conversation);
        if (conversation.getGlpiTicketId() != null) {
            glpiService.addFollowup(conversation.getGlpiTicketId(), "[NexusIT] Atendimento assumido por " + user.getName());
        }
        return getDetail(id);
    }

    @Transactional
    public SupportConversationDetail reply(UUID id, User user, String message) {
        SupportConversation conversation = getOrThrow(id);
        if (conversation.getState() != ConversationState.HUMAN_ACTIVE) {
            throw new ResponseStatusException(HttpStatus.CONFLICT, "Este atendimento não está mais ativo");
        }
        recordMessage(conversation, MessageDirection.OUT, MessageAuthor.TECH, user.getName(), message);
        evolutionApiClient.sendText(conversation.getContact().getPhoneNumber(), "Consultor(a) " + user.getName() + ": " + message);
        if (conversation.getGlpiTicketId() != null) {
            glpiService.addFollowup(conversation.getGlpiTicketId(), "[" + user.getName() + "] " + message);
        }
        return getDetail(id);
    }

    @Transactional
    public SupportConversationDetail close(UUID id) {
        SupportConversation conversation = getOrThrow(id);
        if (conversation.getGlpiTicketId() != null) {
            glpiService.closeTicket(conversation.getGlpiTicketId());
        }
        String text = "✅ Seu chamado foi resolvido! Caso precise de mais ajuda, é só me chamar novamente. Obrigado! 😊";
        recordMessage(conversation, MessageDirection.OUT, MessageAuthor.HERMES, "Hermes", text);
        evolutionApiClient.sendText(conversation.getContact().getPhoneNumber(), text);
        conversation.setState(ConversationState.CLOSED);
        conversation.setClosedAt(LocalDateTime.now());
        conversationRepo.save(conversation);
        stateStore.save(conversation);
        return getDetail(id);
    }

    private SupportConversation getOrThrow(UUID id) {
        return conversationRepo.findByIdWithContact(id)
                .orElseThrow(() -> new EntityNotFoundException("Atendimento não encontrado"));
    }

    private void recordMessage(SupportConversation conversation, MessageDirection direction, MessageAuthor author,
                                String authorName, String content) {
        messageRepo.save(SupportMessage.builder()
                .conversation(conversation)
                .direction(direction)
                .author(author)
                .authorName(authorName)
                .content(content)
                .build());
    }
}
