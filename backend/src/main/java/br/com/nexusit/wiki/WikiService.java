package br.com.nexusit.wiki;

import br.com.nexusit.user.User;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;
import java.util.List;
import java.util.UUID;

@Service @RequiredArgsConstructor
public class WikiService {
    private final WikiRepository repo;

    public List<WikiResponse> findAll(String category) {
        if (category != null && !category.isBlank())
            return repo.findByCategoryOrderByUpdatedAtDesc(category).stream().map(WikiResponse::from).toList();
        return repo.findAllByOrderByUpdatedAtDesc().stream().map(WikiResponse::from).toList();
    }

    public WikiResponse findById(UUID id) { return WikiResponse.from(repo.findById(id).orElseThrow()); }

    public List<WikiResponse> search(String q) { return repo.search(q).stream().map(WikiResponse::from).toList(); }

    public WikiResponse create(WikiRequest req, User user) {
        WikiArticle a = WikiArticle.builder()
                .title(req.title()).category(req.category() != null ? req.category() : "Geral")
                .content(req.content() != null ? req.content() : "").tags(req.tags()).author(user).build();
        return WikiResponse.from(repo.save(a));
    }

    public WikiResponse update(UUID id, WikiRequest req) {
        WikiArticle a = repo.findById(id).orElseThrow();
        a.setTitle(req.title()); a.setCategory(req.category()); a.setContent(req.content()); a.setTags(req.tags());
        return WikiResponse.from(repo.save(a));
    }

    public void delete(UUID id) { repo.deleteById(id); }
}
