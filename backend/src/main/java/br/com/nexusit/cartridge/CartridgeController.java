package br.com.nexusit.cartridge;

import br.com.nexusit.user.User;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.domain.Sort;
import org.springframework.data.web.PageableDefault;
import org.springframework.http.HttpHeaders;
import org.springframework.http.MediaType;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.*;

import java.util.UUID;

@RestController
@RequestMapping("/api/cartridges")
@RequiredArgsConstructor
public class CartridgeController {

    private final CartridgeService service;
    private final CartridgeLabelService labelService;

    @GetMapping
    public Page<CartridgeResponse> list(
            @RequestParam(required = false) CartridgeStatus status,
            @RequestParam(required = false) String search,
            @RequestParam(required = false) String code,
            @RequestParam(required = false) String model,
            @RequestParam(required = false) String printerModel,
            @RequestParam(required = false) String currentSector,
            @PageableDefault(size = 20, sort = "updatedAt", direction = Sort.Direction.DESC) Pageable pageable) {
        return service.list(status, search, code, model, printerModel, currentSector, pageable);
    }

    @GetMapping("/{id}")
    public CartridgeDetailResponse findById(@PathVariable UUID id) {
        return service.findById(id);
    }

    @GetMapping("/by-code/{code}")
    public CartridgeDetailResponse findByCode(@PathVariable String code) {
        return service.findByCode(code);
    }

    @PostMapping
    public CartridgeResponse create(@Valid @RequestBody CartridgeCreateRequest req,
                                     @AuthenticationPrincipal User user) {
        return service.create(req, user);
    }

    @PostMapping("/{id}/install")
    public CartridgeDetailResponse install(@PathVariable UUID id,
                                            @Valid @RequestBody InstallRequest req,
                                            @AuthenticationPrincipal User user) {
        return service.install(id, req, user);
    }

    @PostMapping("/{id}/start-maintenance")
    public CartridgeDetailResponse startMaintenance(@PathVariable UUID id,
                                                     @RequestBody(required = false) MaintenanceStartRequest req,
                                                     @AuthenticationPrincipal User user) {
        return service.startMaintenance(id, req != null ? req : new MaintenanceStartRequest(null), user);
    }

    @PostMapping("/{id}/finish-maintenance")
    public CartridgeDetailResponse finishMaintenance(@PathVariable UUID id,
                                                      @RequestBody(required = false) MaintenanceFinishRequest req,
                                                      @AuthenticationPrincipal User user) {
        return service.finishMaintenance(id, req != null ? req : new MaintenanceFinishRequest(null), user);
    }

    @PostMapping("/{id}/discard")
    public CartridgeDetailResponse discard(@PathVariable UUID id,
                                            @RequestBody(required = false) DiscardRequest req,
                                            @AuthenticationPrincipal User user) {
        return service.discard(id, req != null ? req : new DiscardRequest(null), user);
    }

    @GetMapping("/{id}/etiqueta")
    public ResponseEntity<byte[]> etiqueta(@PathVariable UUID id) {
        byte[] pdf = labelService.generateLabel(id);
        return ResponseEntity.ok()
                .contentType(MediaType.APPLICATION_PDF)
                .header(HttpHeaders.CONTENT_DISPOSITION, "inline; filename=\"etiqueta-cartucho.pdf\"")
                .body(pdf);
    }
}
