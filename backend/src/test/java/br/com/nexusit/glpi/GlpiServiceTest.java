package br.com.nexusit.glpi;

import com.fasterxml.jackson.databind.ObjectMapper;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;

import java.util.List;
import java.util.Map;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.when;

/**
 * GLPI não preenche o técnico/solicitante nas respostas de /Ticket (não são colunas reais
 * da tabela do chamado) — getTickets() resolve isso em lote via /Ticket_User. Esses testes
 * travam esse comportamento pra não regredir (era um bug real em produção, ver histórico).
 */
@ExtendWith(MockitoExtension.class)
class GlpiServiceTest {

    @Mock
    GlpiClient client;

    GlpiService service;

    @org.junit.jupiter.api.BeforeEach
    void setUp() {
        service = new GlpiService(client, new ObjectMapper());
    }

    @Test
    void resolvesAssigneeAndRequesterInBulkWhenMissingFromTicketPayload() {
        Map<String, Object> ticket = Map.of(
                "id", 1, "name", "Impressora sem tinta", "status", 1, "priority", 3,
                "urgency", 3, "impact", 3, "type", 1
        );
        when(client.getList(eq("/Ticket"), any())).thenReturn(List.of(ticket));

        List<Map<String, Object>> ticketUsers = List.of(
                Map.of("tickets_id", 1, "users_id", "João Técnico", "type", 2),
                Map.of("tickets_id", 1, "users_id", "Maria Solicitante", "type", 1)
        );
        when(client.getList(eq("/Ticket_User"), any())).thenReturn(ticketUsers);

        List<GlpiTicket> result = service.getTickets(null);

        assertThat(result).hasSize(1);
        assertThat(result.get(0).assignedTo()).isEqualTo("João Técnico");
        assertThat(result.get(0).requester()).isEqualTo("Maria Solicitante");
    }

    @Test
    void doesNotOverrideAssigneeAlreadyPresentOnTicketPayload() {
        Map<String, Object> ticket = Map.of(
                "id", 2, "name", "Chamado já com técnico", "status", 2, "priority", 3,
                "urgency", 3, "impact", 3, "type", 1,
                "_users_id_assign", "Pedro Já Atribuído"
        );
        when(client.getList(eq("/Ticket"), any())).thenReturn(List.of(ticket));

        // Ticket_User traz outro nome pro mesmo chamado -- o valor já presente no /Ticket deve prevalecer
        when(client.getList(eq("/Ticket_User"), any())).thenReturn(
                List.of(Map.of("tickets_id", 2, "users_id", "Outra Pessoa", "type", 2)));

        List<GlpiTicket> result = service.getTickets(null);

        assertThat(result.get(0).assignedTo()).isEqualTo("Pedro Já Atribuído");
    }

    @Test
    void leavesAssigneeBlankWhenNoTicketUserRowMatches() {
        Map<String, Object> ticket = Map.of(
                "id", 3, "name", "Chamado sem ninguém atribuído", "status", 1, "priority", 2,
                "urgency", 2, "impact", 2, "type", 1
        );
        when(client.getList(eq("/Ticket"), any())).thenReturn(List.of(ticket));
        when(client.getList(eq("/Ticket_User"), any())).thenReturn(List.of());

        List<GlpiTicket> result = service.getTickets(null);

        assertThat(result.get(0).assignedTo()).isBlank();
    }
}
