package br.com.nexusit.broadcast;

import br.com.nexusit.support.WhatsappContact;
import br.com.nexusit.support.WhatsappContactRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Component;
import org.springframework.web.server.ResponseStatusException;

import java.util.UUID;

/** Resolves a (targetType, targetId) pair into an actual WhatsApp number/JID + display label. */
@Component
@RequiredArgsConstructor
public class TargetResolver {

    private final WhatsappContactRepository contactRepository;
    private final NotificationGroupRepository groupRepository;

    public record Resolved(String whatsappTarget, String label) {}

    public Resolved resolve(TargetType type, UUID targetId) {
        if (type == TargetType.CONTACT) {
            WhatsappContact c = contactRepository.findById(targetId)
                    .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "Contato não encontrado"));
            return new Resolved(c.getPhoneNumber(), safeName(c));
        }
        NotificationGroup g = groupRepository.findById(targetId)
                .filter(NotificationGroup::isActive)
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "Grupo não encontrado"));
        return new Resolved(g.getGroupJid(), g.getName());
    }

    private String safeName(WhatsappContact c) {
        String n = c.getDisplayName();
        return n == null || n.isBlank() ? c.getPhoneNumber() : n;
    }
}
