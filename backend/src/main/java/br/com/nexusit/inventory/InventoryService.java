package br.com.nexusit.inventory;

import br.com.nexusit.user.UserRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.List;
import java.util.UUID;

@Service
@RequiredArgsConstructor
@Transactional(readOnly = true)
public class InventoryService {

    private final InventoryRepository repository;
    private final UserRepository userRepository;

    public List<InventoryResponse> findAll(ItemType type, ItemStatus status, String search) {
        List<InventoryItem> items = (search != null && !search.isBlank())
                ? repository.findByFiltersWithSearch(type, status, search)
                : repository.findByTypeAndStatus(type, status);
        return items.stream().map(InventoryResponse::from).toList();
    }

    public InventoryResponse findById(UUID id) {
        return repository.findById(id)
                .map(InventoryResponse::from)
                .orElseThrow(() -> new jakarta.persistence.EntityNotFoundException("Item não encontrado: " + id));
    }

    @Transactional
    public InventoryResponse create(InventoryRequest req) {
        InventoryItem item = toEntity(new InventoryItem(), req);
        return InventoryResponse.from(repository.save(item));
    }

    @Transactional
    public InventoryResponse update(UUID id, InventoryRequest req) {
        InventoryItem item = repository.findById(id)
                .orElseThrow(() -> new jakarta.persistence.EntityNotFoundException("Item não encontrado: " + id));
        return InventoryResponse.from(repository.save(toEntity(item, req)));
    }

    @Transactional
    public void delete(UUID id) {
        if (!repository.existsById(id))
            throw new jakarta.persistence.EntityNotFoundException("Item não encontrado: " + id);
        repository.deleteById(id);
    }

    private InventoryItem toEntity(InventoryItem item, InventoryRequest req) {
        item.setName(req.name());
        item.setType(req.type());
        item.setBrand(req.brand());
        item.setModel(req.model());
        item.setSerialNumber(req.serialNumber());
        item.setLocation(req.location());
        item.setPurchaseDate(req.purchaseDate());
        item.setStatus(req.status() != null ? req.status() : ItemStatus.ACTIVE);
        item.setNotes(req.notes());
        item.setResponsible(req.responsibleId() != null
                ? userRepository.findById(req.responsibleId()).orElse(null) : null);
        return item;
    }
}
