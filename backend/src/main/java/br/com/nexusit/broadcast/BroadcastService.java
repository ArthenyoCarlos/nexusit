package br.com.nexusit.broadcast;

import br.com.nexusit.audit.AuditEventResponse;
import br.com.nexusit.audit.AuditModule;
import br.com.nexusit.audit.AuditService;
import br.com.nexusit.support.WhatsappContact;
import br.com.nexusit.support.WhatsappContactRepository;
import br.com.nexusit.user.User;
import br.com.nexusit.whatsapp.EvolutionApiClient;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.server.ResponseStatusException;

import java.util.List;
import java.util.Map;
import java.util.Set;
import java.util.UUID;
import java.util.stream.Collectors;

@Service
@RequiredArgsConstructor
@Slf4j
@Transactional(readOnly = true)
public class BroadcastService {

    private final WhatsappContactRepository contactRepository;
    private final NotificationGroupRepository groupRepository;
    private final EvolutionApiClient evolutionApiClient;
    private final AuditService auditService;

    public List<BroadcastContact> listContacts() {
        return contactRepository.findAll().stream()
                .sorted((a, b) -> safeName(a).compareToIgnoreCase(safeName(b)))
                .map(BroadcastContact::from)
                .toList();
    }

    public List<BroadcastGroup> listGroups() {
        return groupRepository.findByActiveTrueOrderByNameAsc().stream().map(BroadcastGroup::from).toList();
    }

    /** Live lookup against the Evolution API — not persisted until the user saves it. */
    public List<DiscoveredGroup> discoverGroups() {
        Set<String> savedJids = groupRepository.findByActiveTrueOrderByNameAsc().stream()
                .map(NotificationGroup::getGroupJid).collect(Collectors.toSet());
        return evolutionApiClient.fetchGroups().stream()
                .map(raw -> parseGroup(raw, savedJids))
                .filter(g -> g.groupJid() != null && !g.groupJid().isBlank())
                .toList();
    }

    @Transactional
    public BroadcastGroup saveGroup(SaveGroupRequest req) {
        NotificationGroup group = groupRepository.findByGroupJid(req.groupJid())
                .orElseGet(() -> NotificationGroup.builder().groupJid(req.groupJid()).build());
        group.setName(req.name());
        group.setActive(true);
        return BroadcastGroup.from(groupRepository.save(group));
    }

    @Transactional
    public void deleteGroup(UUID id) {
        groupRepository.findById(id).ifPresent(g -> { g.setActive(false); groupRepository.save(g); });
    }

    // Deliberately not @Transactional: on failure we still need the SEND_FAILED audit
    // write (inside AuditService's own transaction) to survive after this method throws —
    // wrapping this method in a transaction would roll that write back along with it.
    public void send(BroadcastSendRequest req, User actor) {
        String target;
        String targetLabel;
        if (req.targetType() == BroadcastSendRequest.TargetType.CONTACT) {
            WhatsappContact contact = contactRepository.findById(req.targetId())
                    .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "Contato não encontrado"));
            target = contact.getPhoneNumber();
            targetLabel = safeName(contact);
        } else {
            NotificationGroup group = groupRepository.findById(req.targetId())
                    .filter(NotificationGroup::isActive)
                    .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "Grupo não encontrado"));
            target = group.getGroupJid();
            targetLabel = group.getName();
        }

        try {
            evolutionApiClient.sendTextOrThrow(target, req.message());
            auditService.log(AuditModule.BROADCAST, "SEND", actor,
                    req.targetType().name(), req.targetId(), targetLabel, req.message());
        } catch (Exception e) {
            log.warn("Falha ao enviar disparo manual para {} ({}): {}", targetLabel, target, e.toString());
            auditService.log(AuditModule.BROADCAST, "SEND_FAILED", actor,
                    req.targetType().name(), req.targetId(), targetLabel, req.message() + "\n\nErro: " + e.getMessage());
            throw new ResponseStatusException(HttpStatus.BAD_GATEWAY, "Falha ao enviar mensagem pelo WhatsApp: " + e.getMessage());
        }
    }

    public List<AuditEventResponse> history(int days) {
        return auditService.findRecent(days, AuditModule.BROADCAST);
    }

    private DiscoveredGroup parseGroup(Map<String, Object> raw, Set<String> savedJids) {
        String jid = firstNonBlank(str(raw, "id"), str(raw, "jid"));
        String name = firstNonBlank(str(raw, "subject"), str(raw, "name"), jid);
        int size = intVal(raw, "size");
        return new DiscoveredGroup(jid, name, size, savedJids.contains(jid));
    }

    private String str(Map<String, Object> m, String key) {
        Object v = m.get(key);
        return v == null ? "" : v.toString();
    }

    private int intVal(Map<String, Object> m, String key) {
        Object v = m.get(key);
        if (v instanceof Number n) return n.intValue();
        if (v instanceof String s) { try { return Integer.parseInt(s); } catch (NumberFormatException e) { return 0; } }
        return 0;
    }

    private String firstNonBlank(String... values) {
        for (String v : values) if (v != null && !v.isBlank()) return v;
        return "";
    }

    private String safeName(WhatsappContact c) {
        String n = c.getDisplayName();
        return n == null || n.isBlank() ? c.getPhoneNumber() : n;
    }
}
