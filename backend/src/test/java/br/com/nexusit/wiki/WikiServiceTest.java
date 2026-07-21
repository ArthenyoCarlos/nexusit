package br.com.nexusit.wiki;

import br.com.nexusit.ticketwiki.TicketWikiLinkRepository;
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
import static org.mockito.ArgumentMatchers.anyString;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.lenient;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.verifyNoInteractions;
import static org.mockito.Mockito.when;

/**
 * A correspondência de texto em si roda no Postgres (full-text search em português +
 * similaridade de título — ver V41__wiki_fulltext_search.sql e
 * WikiRepository.searchFullText), fora do alcance de um teste unitário sem banco real.
 * Esses testes travam o que continua em Java: montagem da tsquery (com expansão de
 * sinônimos de TI) e os bônus de negócio (uso em chamados, recência) aplicados por cima
 * do que o repositório devolve.
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

        lenient().when(repo.searchFullText(anyString(), anyString()))
                .thenReturn(List.of(vpnArticle, printerArticle));
        lenient().when(ticketWikiLinkRepository.countByWikiArticleIds(org.mockito.ArgumentMatchers.any()))
                .thenReturn(List.of());
    }

    @Test
    void buildsTsQueryWithSynonymExpansion() {
        service.search("computador lento");

        ArgumentCaptor<String> tsQueryCaptor = ArgumentCaptor.forClass(String.class);
        verify(repo).searchFullText(tsQueryCaptor.capture(), eq("computador lento"));

        String tsQuery = tsQueryCaptor.getValue();
        assertThat(tsQuery).contains("computador").contains("notebook");
        assertThat(tsQuery).contains("lento").contains("devagar");
        assertThat(tsQuery).contains("&"); // grupos de palavras diferentes ficam em AND
    }

    @Test
    void preservesRepositoryOrder_whenNoUsageOrRecencyDifference() {
        List<WikiResponse> results = service.search("vpn");

        assertThat(results).extracting(WikiResponse::title)
                .containsExactly("Como configurar VPN", "Trocar cartucho da impressora");
    }

    @Test
    void usageBonusCanReorderResults() {
        when(ticketWikiLinkRepository.countByWikiArticleIds(org.mockito.ArgumentMatchers.any()))
                .thenReturn(List.of(new TicketWikiLinkRepository.WikiArticleLinkCount() {
                    @Override public UUID getWikiArticleId() { return printerArticle.getId(); }
                    @Override public Long getLinkedTicketCount() { return 5L; }
                }));

        List<WikiResponse> results = service.search("vpn impressora");

        assertThat(results.get(0).title()).isEqualTo("Trocar cartucho da impressora");
    }

    @Test
    void ignoresTokensShorterThanThreeChars() {
        List<WikiResponse> results = service.search("vp");

        assertThat(results).isEmpty();
        verifyNoInteractions(repo);
    }

    @Test
    void blankQueryReturnsNoResults() {
        assertThat(service.search("   ")).isEmpty();
        verifyNoInteractions(repo);
    }
}
