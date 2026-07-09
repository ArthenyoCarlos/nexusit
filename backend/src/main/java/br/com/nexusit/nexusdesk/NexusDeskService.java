package br.com.nexusit.nexusdesk;

import br.com.nexusit.inventory.InventoryItem;
import br.com.nexusit.inventory.InventoryRepository;
import br.com.nexusit.user.User;
import br.com.nexusit.vault.CryptoService;
import jakarta.persistence.EntityNotFoundException;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.List;
import java.util.UUID;

@Service
@RequiredArgsConstructor
@Transactional(readOnly = true)
public class NexusDeskService {

    private final NexusDeskDeviceRepository deviceRepo;
    private final NexusDeskSessionRepository sessionRepo;
    private final InventoryRepository inventoryRepo;
    private final CryptoService crypto;

    public List<NexusDeskDeviceResponse> findAll() {
        return deviceRepo.findAllWithRelations().stream().map(NexusDeskDeviceResponse::from).toList();
    }

    @Transactional
    public NexusDeskDeviceResponse create(NexusDeskDeviceRequest req, User currentUser) {
        NexusDeskDevice device = NexusDeskDevice.builder()
                .name(req.name())
                .rustdeskId(req.rustdeskId())
                .encryptedPassword(req.password() != null && !req.password().isBlank() ? crypto.encrypt(req.password()) : null)
                .notes(req.notes())
                .inventoryItem(resolveInventoryItem(req.inventoryItemId()))
                .createdBy(currentUser)
                .build();
        return NexusDeskDeviceResponse.from(deviceRepo.save(device));
    }

    @Transactional
    public NexusDeskDeviceResponse update(UUID id, NexusDeskDeviceRequest req) {
        NexusDeskDevice device = getOrThrow(id);
        device.setName(req.name());
        device.setRustdeskId(req.rustdeskId());
        device.setNotes(req.notes());
        device.setInventoryItem(resolveInventoryItem(req.inventoryItemId()));
        if (req.password() != null && !req.password().isBlank()) {
            device.setEncryptedPassword(crypto.encrypt(req.password()));
        }
        return NexusDeskDeviceResponse.from(deviceRepo.save(device));
    }

    @Transactional
    public void delete(UUID id) {
        if (!deviceRepo.existsById(id)) throw new EntityNotFoundException("Máquina não encontrada");
        deviceRepo.deleteById(id);
    }

    @Transactional
    public NexusDeskConnectResponse connect(UUID id, Integer glpiTicketId, User currentUser) {
        NexusDeskDevice device = getOrThrow(id);
        String password = device.getEncryptedPassword() != null ? crypto.decrypt(device.getEncryptedPassword()) : null;

        sessionRepo.save(NexusDeskSession.builder()
                .device(device)
                .user(currentUser)
                .glpiTicketId(glpiTicketId)
                .build());

        return new NexusDeskConnectResponse(device.getRustdeskId(), password);
    }

    public List<NexusDeskSessionResponse> findSessions() {
        return sessionRepo.findAllWithRelations().stream().map(NexusDeskSessionResponse::from).toList();
    }

    private NexusDeskDevice getOrThrow(UUID id) {
        return deviceRepo.findById(id).orElseThrow(() -> new EntityNotFoundException("Máquina não encontrada"));
    }

    private InventoryItem resolveInventoryItem(UUID id) {
        if (id == null) return null;
        return inventoryRepo.findById(id).orElseThrow(() -> new EntityNotFoundException("Item de inventário não encontrado"));
    }
}
