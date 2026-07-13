package br.com.nexusit.audit;

import br.com.nexusit.user.User;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.ArgumentCaptor;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;

import java.time.LocalDateTime;
import java.util.List;
import java.util.UUID;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.isNull;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

@ExtendWith(MockitoExtension.class)
class AuditServiceTest {

    @Mock
    AuditEventRepository repository;

    AuditService service;

    @BeforeEach
    void setUp() {
        service = new AuditService(repository);
    }

    @Test
    void logDenormalizesActorNameAtWriteTime() {
        User actor = User.builder().id(UUID.randomUUID()).name("Arthenyo Carlos").build();
        UUID targetId = UUID.randomUUID();

        service.log(AuditModule.VAULT, "REVEAL_SECRET", actor, "CREDENTIAL", targetId, "Senha do roteador", "detalhe");

        ArgumentCaptor<AuditEvent> captor = ArgumentCaptor.forClass(AuditEvent.class);
        verify(repository).save(captor.capture());
        AuditEvent saved = captor.getValue();

        assertThat(saved.getModule()).isEqualTo(AuditModule.VAULT);
        assertThat(saved.getAction()).isEqualTo("REVEAL_SECRET");
        assertThat(saved.getActor()).isEqualTo(actor);
        assertThat(saved.getActorName()).isEqualTo("Arthenyo Carlos");
        assertThat(saved.getTargetType()).isEqualTo("CREDENTIAL");
        assertThat(saved.getTargetId()).isEqualTo(targetId);
        assertThat(saved.getTargetLabel()).isEqualTo("Senha do roteador");
    }

    @Test
    void logToleratesNullActorForSystemEvents() {
        service.log(AuditModule.SSH_CONSOLE, "CONNECT", null, "SSH_HOST", null, "srv-interno", null);

        ArgumentCaptor<AuditEvent> captor = ArgumentCaptor.forClass(AuditEvent.class);
        verify(repository).save(captor.capture());
        assertThat(captor.getValue().getActorName()).isNull();
    }

    @Test
    void findRecentMapsEntitiesToResponsesInOrder() {
        AuditEvent event = AuditEvent.builder()
                .id(UUID.randomUUID())
                .module(AuditModule.NEXUSDESK)
                .action("CONNECT")
                .actorName("Ana Técnica")
                .targetLabel("PC-Financeiro")
                .createdAt(LocalDateTime.now())
                .build();
        when(repository.findRecent(any(), isNull())).thenReturn(List.of(event));

        List<AuditEventResponse> result = service.findRecent(7, null);

        assertThat(result).hasSize(1);
        assertThat(result.get(0).module()).isEqualTo("NEXUSDESK");
        assertThat(result.get(0).actorName()).isEqualTo("Ana Técnica");
    }
}
