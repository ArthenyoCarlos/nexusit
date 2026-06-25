package br.com.nexusit.notes;

import br.com.nexusit.user.User;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import org.springframework.http.HttpStatus;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.*;

import java.util.List;
import java.util.UUID;

@RestController
@RequestMapping("/api/notes")
@RequiredArgsConstructor
public class NoteController {

    private final NoteService service;

    @GetMapping
    public List<NoteResponse> findAll(@AuthenticationPrincipal User user) {
        return service.findAll(user);
    }

    @GetMapping("/search")
    public List<NoteResponse> search(
            @RequestParam(required = false) String q,
            @RequestParam(required = false) String tag,
            @RequestParam(required = false) String category,
            @AuthenticationPrincipal User user) {
        return service.search(q, tag, category, user);
    }

    @PostMapping
    @ResponseStatus(HttpStatus.CREATED)
    public NoteResponse create(@Valid @RequestBody NoteRequest req,
                               @AuthenticationPrincipal User user) {
        return service.create(req, user);
    }

    @PutMapping("/{id}")
    public NoteResponse update(@PathVariable UUID id,
                               @Valid @RequestBody NoteRequest req,
                               @AuthenticationPrincipal User user) {
        return service.update(id, req, user);
    }

    @DeleteMapping("/{id}")
    @ResponseStatus(HttpStatus.NO_CONTENT)
    public void delete(@PathVariable UUID id, @AuthenticationPrincipal User user) {
        service.delete(id, user);
    }
}
