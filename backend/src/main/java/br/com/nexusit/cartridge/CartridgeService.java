package br.com.nexusit.cartridge;

import br.com.nexusit.user.User;
import jakarta.persistence.EntityNotFoundException;
import lombok.RequiredArgsConstructor;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.server.ResponseStatusException;

import java.util.List;
import java.util.UUID;

/**
 * Inventário de materiais de consumo (hoje só cartuchos de impressora — a empresa reabastece
 * em vez de trocar peça, então o ciclo de vida é: cadastro -> manutenção (reabastecimento,
 * quantas vezes precisar) -> descarte. Setor/local é sempre opcional: nem sempre quem faz a
 * manutenção sabe de onde o cartucho veio.
 */
@Service
@RequiredArgsConstructor
@Transactional(readOnly = true)
public class CartridgeService {

    private final CartridgeRepository repository;
    private final CartridgeEventRepository eventRepository;

    public List<CartridgeResponse> list(String status, String search) {
        List<Cartridge> all = repository.findAllByOrderByUpdatedAtDesc();
        String q = search == null ? "" : search.trim().toLowerCase();
        return all.stream()
                .filter(c -> status == null || status.isBlank() || c.getStatus().name().equals(status))
                .filter(c -> q.isBlank()
                        || c.getModel().toLowerCase().contains(q)
                        || c.getCode().toLowerCase().contains(q)
                        || (c.getCurrentSector() != null && c.getCurrentSector().toLowerCase().contains(q))
                        || (c.getPrinterModel() != null && c.getPrinterModel().toLowerCase().contains(q)))
                .map(CartridgeResponse::from)
                .toList();
    }

    public CartridgeDetailResponse findById(UUID id) {
        Cartridge c = repository.findById(id)
                .orElseThrow(() -> new EntityNotFoundException("Cartucho não encontrado"));
        return toDetail(c);
    }

    public CartridgeDetailResponse findByCode(String code) {
        Cartridge c = repository.findByCode(code)
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "Nenhum cartucho com esse código"));
        return toDetail(c);
    }

    @Transactional
    public CartridgeResponse create(CartridgeCreateRequest req, User user) {
        String code = "CRT-" + String.format("%04d", repository.nextCodeSequence());
        Cartridge c = Cartridge.builder()
                .code(code)
                .model(req.model())
                .printerModel(req.printerModel())
                .status(CartridgeStatus.EM_ESTOQUE)
                .currentSector(req.initialSector())
                .build();
        c = repository.save(c);

        eventRepository.save(CartridgeEvent.builder()
                .cartridge(c)
                .type(CartridgeEventType.CADASTRO)
                .sector(req.initialSector())
                .performedByName(actorName(user))
                .build());

        return CartridgeResponse.from(c);
    }

    @Transactional
    public CartridgeDetailResponse startMaintenance(UUID id, MaintenanceStartRequest req, User user) {
        Cartridge c = repository.findById(id)
                .orElseThrow(() -> new EntityNotFoundException("Cartucho não encontrado"));
        if (c.getStatus() == CartridgeStatus.DESCARTADO)
            throw new ResponseStatusException(HttpStatus.CONFLICT, "Este cartucho já foi descartado");
        if (c.getStatus() == CartridgeStatus.EM_MANUTENCAO)
            throw new ResponseStatusException(HttpStatus.CONFLICT, "Este cartucho já está em manutenção");

        if (req.sector() != null && !req.sector().isBlank()) c.setCurrentSector(req.sector());
        c.setStatus(CartridgeStatus.EM_MANUTENCAO);
        repository.save(c);

        eventRepository.save(CartridgeEvent.builder()
                .cartridge(c)
                .type(CartridgeEventType.INICIO_MANUTENCAO)
                .sector(req.sector())
                .performedByName(actorName(user))
                .build());

        return toDetail(c);
    }

    @Transactional
    public CartridgeDetailResponse finishMaintenance(UUID id, MaintenanceFinishRequest req, User user) {
        Cartridge c = repository.findById(id)
                .orElseThrow(() -> new EntityNotFoundException("Cartucho não encontrado"));
        if (c.getStatus() != CartridgeStatus.EM_MANUTENCAO)
            throw new ResponseStatusException(HttpStatus.CONFLICT, "Este cartucho não está em manutenção");

        c.setStatus(CartridgeStatus.EM_ESTOQUE);
        repository.save(c);

        eventRepository.save(CartridgeEvent.builder()
                .cartridge(c)
                .type(CartridgeEventType.FIM_MANUTENCAO)
                .sector(c.getCurrentSector())
                .notes(req.notes())
                .performedByName(actorName(user))
                .build());

        return toDetail(c);
    }

    @Transactional
    public CartridgeDetailResponse discard(UUID id, DiscardRequest req, User user) {
        Cartridge c = repository.findById(id)
                .orElseThrow(() -> new EntityNotFoundException("Cartucho não encontrado"));
        if (c.getStatus() == CartridgeStatus.DESCARTADO)
            throw new ResponseStatusException(HttpStatus.CONFLICT, "Este cartucho já foi descartado");

        c.setStatus(CartridgeStatus.DESCARTADO);
        repository.save(c);

        eventRepository.save(CartridgeEvent.builder()
                .cartridge(c)
                .type(CartridgeEventType.DESCARTE)
                .sector(c.getCurrentSector())
                .notes(req.notes())
                .performedByName(actorName(user))
                .build());

        return toDetail(c);
    }

    private CartridgeDetailResponse toDetail(Cartridge c) {
        List<CartridgeEventResponse> events = eventRepository.findByCartridgeIdOrderByCreatedAtDesc(c.getId())
                .stream().map(CartridgeEventResponse::from).toList();
        return new CartridgeDetailResponse(CartridgeResponse.from(c), events);
    }

    private String actorName(User user) {
        return user != null ? user.getName() : null;
    }
}
