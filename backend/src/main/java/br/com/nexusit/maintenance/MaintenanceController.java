package br.com.nexusit.maintenance;

import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.util.List;
import java.util.UUID;

@RestController
@RequestMapping("/api/inventory/{inventoryId}/maintenance")
@RequiredArgsConstructor
public class MaintenanceController {

    private final MaintenanceService service;

    @GetMapping
    public List<MaintenanceResponse> findAll(@PathVariable UUID inventoryId) {
        return service.findByItem(inventoryId);
    }

    @PostMapping
    public ResponseEntity<MaintenanceResponse> create(
            @PathVariable UUID inventoryId,
            @Valid @RequestBody MaintenanceRequest req
    ) {
        return ResponseEntity.status(HttpStatus.CREATED).body(service.create(inventoryId, req));
    }

    @DeleteMapping("/{id}")
    public ResponseEntity<Void> delete(@PathVariable UUID inventoryId, @PathVariable UUID id) {
        service.delete(id);
        return ResponseEntity.noContent().build();
    }
}
