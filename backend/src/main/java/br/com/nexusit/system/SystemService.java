package br.com.nexusit.system;

import br.com.nexusit.inventory.InventoryRepository;
import br.com.nexusit.user.UserRepository;
import jakarta.persistence.EntityNotFoundException;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.List;
import java.util.UUID;

@Service
@RequiredArgsConstructor
@Transactional(readOnly = true)
public class SystemService {

    private final SystemRepository repository;
    private final UserRepository userRepository;
    private final InventoryRepository inventoryRepository;

    public List<SystemResponse> findAll(SystemCategory category, SystemStatus status) {
        return repository.findByFilters(category, status)
                .stream().map(SystemResponse::from).toList();
    }

    public SystemResponse findById(UUID id) {
        return repository.findByIdWithRelations(id)
                .map(SystemResponse::from)
                .orElseThrow(() -> new EntityNotFoundException("Sistema não encontrado: " + id));
    }

    @Transactional
    public SystemResponse create(SystemRequest req) {
        return SystemResponse.from(repository.save(toEntity(new SystemEntry(), req)));
    }

    @Transactional
    public SystemResponse update(UUID id, SystemRequest req) {
        SystemEntry entry = repository.findById(id)
                .orElseThrow(() -> new EntityNotFoundException("Sistema não encontrado: " + id));
        return SystemResponse.from(repository.save(toEntity(entry, req)));
    }

    @Transactional
    public void delete(UUID id) {
        if (!repository.existsById(id))
            throw new EntityNotFoundException("Sistema não encontrado: " + id);
        repository.deleteById(id);
    }

    private SystemEntry toEntity(SystemEntry entry, SystemRequest req) {
        entry.setName(req.name());
        entry.setUrl(req.url());
        entry.setDescription(req.description());
        entry.setCategory(req.category() != null ? req.category() : SystemCategory.OUTRO);
        entry.setStatus(req.status() != null ? req.status() : SystemStatus.ACTIVE);
        entry.setDocumentation(req.documentation());
        entry.setResponsible(req.responsibleId() != null
                ? userRepository.findById(req.responsibleId()).orElse(null) : null);
        entry.setServer(req.serverId() != null
                ? inventoryRepository.findById(req.serverId()).orElse(null) : null);
        return entry;
    }
}
