package br.com.nexusit.networkdoc;

import br.com.nexusit.user.User;
import lombok.RequiredArgsConstructor;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.server.ResponseStatusException;

import java.util.List;
import java.util.UUID;

@Service
@RequiredArgsConstructor
@Transactional
public class NetworkDocService {

    private final NetworkDocRepository repo;

    @Transactional(readOnly = true)
    public List<NetworkDocResponse> findAll() {
        return repo.findAllWithUpdatedBy().stream()
                .map(NetworkDocResponse::from)
                .toList();
    }

    @Transactional(readOnly = true)
    public List<NetworkDocResponse> findBySection(String section) {
        return repo.findBySectionFetched(section).stream()
                .map(NetworkDocResponse::from)
                .toList();
    }

    public NetworkDocResponse create(NetworkDocRequest req, User user) {
        NetworkDoc doc = NetworkDoc.builder()
                .title(req.title())
                .section(req.section())
                .content(req.content())
                .updatedBy(user)
                .build();
        return NetworkDocResponse.from(repo.save(doc));
    }

    public NetworkDocResponse update(UUID id, NetworkDocRequest req, User user) {
        NetworkDoc doc = repo.findByIdFetched(id)
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND));
        doc.setTitle(req.title());
        doc.setSection(req.section());
        doc.setContent(req.content());
        doc.setUpdatedBy(user);
        return NetworkDocResponse.from(repo.save(doc));
    }

    public void delete(UUID id) {
        if (!repo.existsById(id)) throw new ResponseStatusException(HttpStatus.NOT_FOUND);
        repo.deleteById(id);
    }
}
