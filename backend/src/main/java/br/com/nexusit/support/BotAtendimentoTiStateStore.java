package br.com.nexusit.support;

import com.fasterxml.jackson.core.type.TypeReference;
import com.fasterxml.jackson.databind.ObjectMapper;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Component;

import java.nio.file.Files;
import java.nio.file.Path;
import java.time.LocalDateTime;
import java.util.LinkedHashMap;
import java.util.Map;

@Component
@RequiredArgsConstructor
@Slf4j
public class BotAtendimentoTiStateStore {

    private static final Path STATE_PATH = Path.of(System.getProperty(
            "bot.atendimento.ti.state-path",
            "/home/galdino/.hermes/whatsapp-bot-state.json"
    ));

    private final ObjectMapper objectMapper;

    public synchronized void save(SupportConversation conversation) {
        if (conversation == null || conversation.getContact() == null) return;
        try {
            Files.createDirectories(STATE_PATH.getParent());
            Map<String, Object> root = readRoot();
            Map<String, Object> chats = asMap(root.computeIfAbsent("chats", k -> new LinkedHashMap<>()));
            WhatsappContact c = conversation.getContact();
            Map<String, Object> state = new LinkedHashMap<>();
            state.put("phoneNumber", c.getPhoneNumber());
            state.put("displayName", c.getDisplayName());
            state.put("glpiUserId", c.getGlpiUserId());
            state.put("glpiUserName", c.getGlpiUserName());
            state.put("conversationId", conversation.getId() == null ? null : conversation.getId().toString());
            state.put("conversationState", conversation.getState() == null ? null : conversation.getState().name());
            state.put("glpiTicketId", conversation.getGlpiTicketId());
            state.put("claimedBy", conversation.getClaimedBy() == null ? null : conversation.getClaimedBy().getName());
            state.put("updatedAt", LocalDateTime.now().toString());
            chats.put(c.getPhoneNumber(), state);
            root.put("updatedAt", LocalDateTime.now().toString());
            objectMapper.writerWithDefaultPrettyPrinter().writeValue(STATE_PATH.toFile(), root);
        } catch (Exception e) {
            log.warn("Falha ao salvar estado do bot de atendimento TI em {}: {}", STATE_PATH, e.toString());
        }
    }

    private Map<String, Object> readRoot() {
        try {
            if (Files.exists(STATE_PATH) && Files.size(STATE_PATH) > 0) {
                return objectMapper.readValue(STATE_PATH.toFile(), new TypeReference<LinkedHashMap<String, Object>>() {});
            }
        } catch (Exception e) {
            log.warn("Estado existente do bot TI inválido, recriando {}: {}", STATE_PATH, e.toString());
        }
        Map<String, Object> root = new LinkedHashMap<>();
        root.put("bot", "bot-atendimento-ti");
        root.put("instance", "ti-galdino");
        root.put("chats", new LinkedHashMap<String, Object>());
        return root;
    }

    @SuppressWarnings("unchecked")
    private Map<String, Object> asMap(Object value) {
        return value instanceof Map<?, ?> ? (Map<String, Object>) value : new LinkedHashMap<>();
    }
}
