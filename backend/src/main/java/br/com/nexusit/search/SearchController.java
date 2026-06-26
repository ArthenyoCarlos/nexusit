package br.com.nexusit.search;

import br.com.nexusit.inventory.InventoryRepository;
import br.com.nexusit.notes.NoteRepository;
import br.com.nexusit.system.SystemRepository;
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

        return new SearchResult(hits);
    }

    public record SearchResult(List<Hit> hits) {
        public record Hit(String type, String id, String title, String subtitle, String path) {}
        public static SearchResult empty() { return new SearchResult(List.of()); }
    }
}
