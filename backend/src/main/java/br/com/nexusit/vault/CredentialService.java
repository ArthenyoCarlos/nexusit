package br.com.nexusit.vault;

import br.com.nexusit.user.User;
import br.com.nexusit.user.UserRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.List;
import java.util.UUID;

@Service
@RequiredArgsConstructor
@Transactional(readOnly = true)
public class CredentialService {

    private final CredentialRepository repository;
    private final UserRepository userRepository;
    private final CryptoService crypto;

    public List<CredentialResponse> findAll(String search, String type) {
        return repository.findByFilters(
                search != null && !search.isBlank() ? search : null,
                type != null && !type.isBlank() ? type : null
        ).stream().map(CredentialResponse::from).toList();
    }

    public String reveal(UUID id) {
        Credential c = repository.findById(id)
                .orElseThrow(() -> new jakarta.persistence.EntityNotFoundException("Credencial não encontrada"));
        return crypto.decrypt(c.getSecret());
    }

    @Transactional
    public CredentialResponse create(CredentialRequest req, User currentUser) {
        Credential c = Credential.builder()
                .title(req.title())
                .type(req.type() != null ? req.type() : "PASSWORD")
                .username(req.username())
                .secret(crypto.encrypt(req.secret()))
                .url(req.url())
                .description(req.description())
                .tags(req.tags())
                .createdBy(currentUser)
                .build();
        return CredentialResponse.from(repository.save(c));
    }

    @Transactional
    public CredentialResponse update(UUID id, CredentialRequest req) {
        Credential c = repository.findById(id)
                .orElseThrow(() -> new jakarta.persistence.EntityNotFoundException("Credencial não encontrada"));
        c.setTitle(req.title());
        if (req.type() != null) c.setType(req.type());
        c.setUsername(req.username());
        c.setSecret(crypto.encrypt(req.secret()));
        c.setUrl(req.url());
        c.setDescription(req.description());
        c.setTags(req.tags());
        return CredentialResponse.from(repository.save(c));
    }

    @Transactional
    public void delete(UUID id) {
        if (!repository.existsById(id))
            throw new jakarta.persistence.EntityNotFoundException("Credencial não encontrada");
        repository.deleteById(id);
    }
}
