package br.com.nexusit.search;

import br.com.nexusit.inventory.InventoryRepository;
import br.com.nexusit.notes.NoteRepository;
import br.com.nexusit.system.SystemRepository;
import br.com.nexusit.wiki.WikiRepository;
import br.com.nexusit.contracts.ContractRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

import java.util.ArrayList;
import java.util.List;

@RestController
@RequestMapping("/api/search")
@RequiredArgsConstructor
public class SearchController {

    private final SystemRepository systemRepo;
    private final InventoryRepository inventoryRepo;
    private final NoteRepository noteRepo;
    private final WikiRepository wikiRepo;
    private final ContractRepository contractRepo;

    @GetMapping
    public SearchResult search(
            @RequestParam String q,
            @AuthenticationPrincipal br.com.nexusit.user.User currentUser
    ) {
        if (q == null || q.isBlank() || q.length() < 2) return SearchResult.empty();

        String term = q.trim().toLowerCase();

        List<SearchResult.Hit> hits = new ArrayList<>();

        // Systems
        systemRepo.findAll().stream()
                .filter(s -> s.getName().toLowerCase().contains(term)
                        || (s.getDescription() != null && s.getDescription().toLowerCase().contains(term)))
                .limit(5)
                .forEach(s -> hits.add(new SearchResult.Hit("system", s.getId().toString(), s.getName(),
                        s.getDescription(), "/systems/" + s.getId())));

        // Inventory
        inventoryRepo.findAll().stream()
                .filter(i -> i.getName().toLowerCase().contains(term)
                        || (i.getSerialNumber() != null && i.getSerialNumber().toLowerCase().contains(term))
                        || (i.getTombamento() != null && i.getTombamento().toLowerCase().contains(term)))
                .limit(5)
                .forEach(i -> hits.add(new SearchResult.Hit("inventory", i.getId().toString(), i.getName(),
                        i.getTombamento() != null ? i.getTombamento() : i.getType().name(),
                        "/inventory/" + i.getId())));

        // Notes
        noteRepo.findAll().stream()
                .filter(n -> {
                    boolean visOk = n.getVisibility().name().equals("SHARED") ||
                            n.getAuthor().getId().equals(currentUser.getId());
                    return visOk && (n.getTitle().toLowerCase().contains(term)
                            || (n.getContent() != null && n.getContent().toLowerCase().contains(term)));
                })
                .limit(3)
                .forEach(n -> hits.add(new SearchResult.Hit("note", n.getId().toString(), n.getTitle(),
                        null, "/notes")));

        // Wiki
        wikiRepo.findAll().stream()
                .filter(a -> a.getTitle().toLowerCase().contains(term)
                        || a.getCategory().toLowerCase().contains(term)
                        || (a.getContent() != null && a.getContent().toLowerCase().contains(term)))
                .limit(4)
                .forEach(a -> hits.add(new SearchResult.Hit("wiki", a.getId().toString(), a.getTitle(),
                        a.getCategory(), "/wiki/" + a.getId())));

        // Contracts
        contractRepo.findAll().stream()
                .filter(c -> c.getName().toLowerCase().contains(term)
                        || (c.getVendor() != null && c.getVendor().toLowerCase().contains(term)))
                .limit(3)
                .forEach(c -> hits.add(new SearchResult.Hit("contract", c.getId().toString(), c.getName(),
                        c.getVendor(), "/contracts")));

        return new SearchResult(hits);
    }

    public record SearchResult(List<Hit> hits) {
        public record Hit(String type, String id, String title, String subtitle, String path) {}
        public static SearchResult empty() { return new SearchResult(List.of()); }
    }
}
