package br.com.nexusit.notes;

import br.com.nexusit.user.User;
import jakarta.persistence.EntityNotFoundException;
import lombok.RequiredArgsConstructor;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.server.ResponseStatusException;

import java.util.List;
import java.util.UUID;
import java.util.stream.Stream;

@Service
@RequiredArgsConstructor
@Transactional(readOnly = true)
public class NoteService {

    private final NoteRepository repository;

    public List<NoteResponse> findAll(User currentUser) {
        return repository.findVisibleToUser(currentUser)
                .stream().map(NoteResponse::from).toList();
    }

    public List<NoteResponse> search(String q, String tag, String category, User currentUser) {
        Stream<Note> notes;
        if (q != null && !q.isBlank()) {
            notes = repository.searchByText(currentUser, q).stream();
        } else {
            notes = repository.findVisibleToUser(currentUser).stream();
        }

        if (tag != null && !tag.isBlank()) {
            String tagLower = tag.toLowerCase();
            notes = notes.filter(n -> n.getTags().stream()
                    .anyMatch(t -> tagLower.equals(t.getTag() == null ? null : t.getTag().toLowerCase())));
        }
        if (category != null && !category.isBlank()) {
            String catLower = category.toLowerCase();
            notes = notes.filter(n -> n.getTags().stream()
                    .anyMatch(t -> catLower.equals(t.getCategory() == null ? null : t.getCategory().toLowerCase())));
        }

        return notes.map(NoteResponse::from).toList();
    }

    @Transactional
    public NoteResponse create(NoteRequest req, User currentUser) {
        Note note = Note.builder()
                .title(req.title())
                .content(req.content())
                .visibility(req.visibility() != null ? req.visibility() : NoteVisibility.PERSONAL)
                .author(currentUser)
                .build();

        if (req.tags() != null) {
            req.tags().forEach(t -> {
                NoteTag tag = NoteTag.builder()
                        .note(note).tag(t.tag()).category(t.category()).build();
                note.getTags().add(tag);
            });
        }

        return NoteResponse.from(repository.save(note));
    }

    @Transactional
    public NoteResponse update(UUID id, NoteRequest req, User currentUser) {
        Note note = repository.findById(id)
                .orElseThrow(() -> new EntityNotFoundException("Anotação não encontrada: " + id));

        if (!note.getAuthor().getId().equals(currentUser.getId())) {
            throw new ResponseStatusException(HttpStatus.FORBIDDEN, "Apenas o autor pode editar esta anotação");
        }

        note.setTitle(req.title());
        note.setContent(req.content());
        if (req.visibility() != null) note.setVisibility(req.visibility());

        note.getTags().clear();
        if (req.tags() != null) {
            req.tags().forEach(t -> note.getTags().add(
                    NoteTag.builder().note(note).tag(t.tag()).category(t.category()).build()));
        }

        return NoteResponse.from(repository.save(note));
    }

    @Transactional
    public void delete(UUID id, User currentUser) {
        Note note = repository.findById(id)
                .orElseThrow(() -> new EntityNotFoundException("Anotação não encontrada: " + id));

        boolean isAdmin = currentUser.getAuthorities().stream()
                .anyMatch(a -> a.getAuthority().equals("ROLE_ADMIN"));

        if (!note.getAuthor().getId().equals(currentUser.getId()) && !isAdmin) {
            throw new ResponseStatusException(HttpStatus.FORBIDDEN, "Sem permissão para excluir esta anotação");
        }

        repository.delete(note);
    }
}
