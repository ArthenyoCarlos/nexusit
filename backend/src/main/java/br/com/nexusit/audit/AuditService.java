package br.com.nexusit.audit;

import br.com.nexusit.user.User;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.LocalDateTime;
import java.util.List;
import java.util.UUID;

@Service
@RequiredArgsConstructor
@Transactional(readOnly = true)
public class AuditService {

    private final AuditEventRepository repository;

    @Transactional
    public void log(AuditModule module, String action, User actor, String targetType, UUID targetId, String targetLabel, String details) {
        repository.save(AuditEvent.builder()
                .module(module)
                .action(action)
                .actor(actor)
                .actorName(actor != null ? actor.getName() : null)
                .targetType(targetType)
                .targetId(targetId)
                .targetLabel(targetLabel)
                .details(details)
                .build());
    }

    public List<AuditEventResponse> findRecent(int days, AuditModule module) {
        LocalDateTime since = LocalDateTime.now().minusDays(Math.max(1, days));
        return repository.findRecent(since, module).stream().map(AuditEventResponse::from).toList();
    }
}
