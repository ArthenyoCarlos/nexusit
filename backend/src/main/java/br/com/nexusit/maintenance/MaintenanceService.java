package br.com.nexusit.maintenance;

import br.com.nexusit.inventory.InventoryRepository;
import br.com.nexusit.user.UserRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.List;
import java.util.UUID;

@Service
@RequiredArgsConstructor
@Transactional(readOnly = true)
public class MaintenanceService {

    private final MaintenanceRepository repository;
    private final InventoryRepository inventoryRepository;
    private final UserRepository userRepository;

    public List<MaintenanceResponse> findByItem(UUID inventoryId) {
        return repository.findByInventoryItemId(inventoryId)
                .stream().map(MaintenanceResponse::from).toList();
    }

    @Transactional
    public MaintenanceResponse create(UUID inventoryId, MaintenanceRequest req) {
        var item = inventoryRepository.findById(inventoryId)
                .orElseThrow(() -> new jakarta.persistence.EntityNotFoundException("Item não encontrado"));
        MaintenanceRecord record = MaintenanceRecord.builder()
                .inventoryItem(item)
                .title(req.title())
                .description(req.description())
                .performedAt(req.performedAt())
                .cost(req.cost())
                .performedBy(req.performedById() != null
                        ? userRepository.findById(req.performedById()).orElse(null) : null)
                .build();
        return MaintenanceResponse.from(repository.save(record));
    }

    @Transactional
    public void delete(UUID id) {
        if (!repository.existsById(id))
            throw new jakarta.persistence.EntityNotFoundException("Registro não encontrado");
        repository.deleteById(id);
    }
}
