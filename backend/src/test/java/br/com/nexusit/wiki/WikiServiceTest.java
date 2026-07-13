package br.com.nexusit.wiki;

import br.com.nexusit.ticketwiki.TicketWikiLinkRepository;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;

import java.time.LocalDateTime;
import java.util.List;
import java.util.UUID;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.Mockito.lenient;
import static org.mockito.Mockito.when;

/**
 * Busca da Wiki é um scorer local por relevância (título/categoria/tags/conteúdo), sem
 * LLM externo -- ver WikiService.search(). Esses testes travam o comportamento básico:
 * relevância bate o alvo certo e ignora consultas curtas demais.
 */
@ExtendWith(MockitoExtension.class)
class WikiServiceTest {

    @Mock
    WikiRepository repo;

    @Mock
    TicketWikiLinkRepository ticketWikiLinkRepository;

    WikiService service;

    WikiArticle vpnArticle;
    WikiArticle printerArticle;

    @BeforeEach
    void setUp() {
        service = new WikiService(repo, ticketWikiLinkRepository);

        vpnArticle = WikiArticle.builder()
                .id(UUID.randomUUID())
                .title("Como configurar VPN")
                .category("Rede")
                .content("Passo a passo para configurar o cliente VPN nos notebooks da empresa.")
                .tags("vpn, rede, acesso remoto")
                .createdAt(LocalDateTime.now())
                .updatedAt(LocalDateTime.now())
                .build();

        printerArticle = WikiArticle.builder()
                .id(UUID.randomUUID())
                .title("Trocar cartucho da impressora")
                .category("Hardware")
                .content("Procedimento para trocar o cartucho de tinta da impressora do financeiro.")
                .tags("impressora, hardware")
                .createdAt(LocalDateTime.now())
                .updatedAt(LocalDateTime.now())
                .build();

        lenient().when(repo.findAllByOrderByUpdatedAtDesc())
                .thenReturn(List.of(vpnArticle, printerArticle));
        lenient().when(ticketWikiLinkRepository.countByWikiArticleIds(org.mockito.ArgumentMatchers.any()))
                .thenReturn(List.of());
    }

    @Test
    void ranksArticleMatchingQueryAboveUnrelatedOne() {
        List<WikiResponse> results = service.search("vpn");

        assertThat(results).extracting(WikiResponse::title).containsExactly("Como configurar VPN");
    }

    @Test
    void matchesByContentEvenWhenTitleDiffersFromQuery() {
        List<WikiResponse> results = service.search("cartucho impressora");

        assertThat(results).extracting(WikiResponse::title).containsExactly("Trocar cartucho da impressora");
    }

    @Test
    void ignoresTokensShorterThanThreeChars() {
        List<WikiResponse> results = service.search("vp");

        assertThat(results).isEmpty();
    }

    @Test
    void blankQueryReturnsNoResults() {
        assertThat(service.search("   ")).isEmpty();
    }
}
