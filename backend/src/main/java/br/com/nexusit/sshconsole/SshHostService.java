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
        if (req.password() == null || req.password().isBlank()) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Senha é obrigatória ao cadastrar uma máquina");
        }
        SshHost host = SshHost.builder()
                .name(req.name())
                .host(req.host())
                .port(req.port())
                .username(req.username())
                .encryptedPassword(crypto.encrypt(req.password()))
                .description(req.description())
                .inventoryItem(resolveInventoryItem(req.inventoryItemId()))
                .createdBy(currentUser)
                .build();
        return SshHostResponse.from(repo.save(host));
    }

    @Transactional
    public SshHostResponse update(UUID id, SshHostRequest req) {
        SshHost host = getOrThrow(id);
        host.setName(req.name());
        host.setHost(req.host());
        host.setPort(req.port());
        host.setUsername(req.username());
        host.setDescription(req.description());
        host.setInventoryItem(resolveInventoryItem(req.inventoryItemId()));
        if (req.password() != null && !req.password().isBlank()) {
            host.setEncryptedPassword(crypto.encrypt(req.password()));
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

    private SshHost getOrThrow(UUID id) {
        return repo.findById(id).orElseThrow(() -> new EntityNotFoundException("Máquina não encontrada"));
    }

    private InventoryItem resolveInventoryItem(UUID id) {
        if (id == null) return null;
        return inventoryRepo.findById(id).orElseThrow(() -> new EntityNotFoundException("Item de inventário não encontrado"));
    }
}
