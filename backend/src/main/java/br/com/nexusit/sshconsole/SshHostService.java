package br.com.nexusit.sshconsole;

import br.com.nexusit.inventory.InventoryItem;
import br.com.nexusit.inventory.InventoryRepository;
import br.com.nexusit.user.User;
import br.com.nexusit.vault.CryptoService;
import jakarta.persistence.EntityNotFoundException;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.server.ResponseStatusException;
import org.springframework.http.HttpStatus;

import java.util.List;
import java.util.UUID;

@Service
@RequiredArgsConstructor
@Transactional(readOnly = true)
public class SshHostService {

    private final SshHostRepository repo;
    private final InventoryRepository inventoryRepo;
    private final CryptoService crypto;

    public List<SshHostResponse> findAll() {
        return repo.findAll().stream().map(SshHostResponse::from).toList();
    }

    public SshHostResponse findById(UUID id) {
        return SshHostResponse.from(getOrThrow(id));
    }

    @Transactional
    public SshHostResponse create(SshHostRequest req, User currentUser) {
        SshAuthType authType = SshAuthType.fromNullable(req.authType());
        validateCreateCredential(req, authType);

        SshHost host = SshHost.builder()
                .name(req.name())
                .host(req.host())
                .port(req.port())
                .username(req.username())
                .authType(authType)
                .encryptedPassword(authType == SshAuthType.PASSWORD ? crypto.encrypt(req.password()) : null)
                .encryptedPrivateKey(authType == SshAuthType.PRIVATE_KEY ? crypto.encrypt(req.privateKey()) : null)
                .encryptedPrivateKeyPassphrase(encryptOptional(req.privateKeyPassphrase()))
                .description(req.description())
                .inventoryItem(resolveInventoryItem(req.inventoryItemId()))
                .createdBy(currentUser)
                .build();
        return SshHostResponse.from(repo.save(host));
    }

    @Transactional
    public SshHostResponse update(UUID id, SshHostRequest req) {
        SshHost host = getOrThrow(id);
        SshAuthType authType = SshAuthType.fromNullable(req.authType());
        host.setName(req.name());
        host.setHost(req.host());
        host.setPort(req.port());
        host.setUsername(req.username());
        host.setAuthType(authType);
        host.setDescription(req.description());
        host.setInventoryItem(resolveInventoryItem(req.inventoryItemId()));

        if (authType == SshAuthType.PASSWORD) {
            host.setEncryptedPrivateKey(null);
            host.setEncryptedPrivateKeyPassphrase(null);
            if (req.password() != null && !req.password().isBlank()) {
                host.setEncryptedPassword(crypto.encrypt(req.password()));
            } else if (host.getEncryptedPassword() == null || host.getEncryptedPassword().isBlank()) {
                throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Senha é obrigatória para autenticação por senha");
            }
        } else {
            host.setEncryptedPassword(null);
            if (req.privateKey() != null && !req.privateKey().isBlank()) {
                host.setEncryptedPrivateKey(crypto.encrypt(req.privateKey()));
            } else if (host.getEncryptedPrivateKey() == null || host.getEncryptedPrivateKey().isBlank()) {
                throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Chave privada é obrigatória para autenticação por chave");
            }
            if (req.privateKeyPassphrase() != null) {
                host.setEncryptedPrivateKeyPassphrase(encryptOptional(req.privateKeyPassphrase()));
            }
        }
        return SshHostResponse.from(repo.save(host));
    }

    @Transactional
    public SshHostResponse resetHostKey(UUID id) {
        SshHost host = getOrThrow(id);
        host.setHostKeyFingerprint(null);
        return SshHostResponse.from(repo.save(host));
    }

    @Transactional
    public void delete(UUID id) {
        if (!repo.existsById(id)) throw new EntityNotFoundException("Máquina não encontrada");
        repo.deleteById(id);
    }

    private void validateCreateCredential(SshHostRequest req, SshAuthType authType) {
        if (authType == SshAuthType.PASSWORD && (req.password() == null || req.password().isBlank())) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Senha é obrigatória para autenticação por senha");
        }
        if (authType == SshAuthType.PRIVATE_KEY && (req.privateKey() == null || req.privateKey().isBlank())) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Chave privada é obrigatória para autenticação por chave");
        }
    }

    private String encryptOptional(String value) {
        return value == null || value.isBlank() ? null : crypto.encrypt(value);
    }

    private SshHost getOrThrow(UUID id) {
        return repo.findById(id).orElseThrow(() -> new EntityNotFoundException("Máquina não encontrada"));
    }

    private InventoryItem resolveInventoryItem(UUID id) {
        if (id == null) return null;
        return inventoryRepo.findById(id).orElseThrow(() -> new EntityNotFoundException("Item de inventário não encontrado"));
    }
}
