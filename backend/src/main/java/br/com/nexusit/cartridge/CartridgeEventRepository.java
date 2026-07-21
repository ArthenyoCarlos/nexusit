package br.com.nexusit.cartridge;

import org.springframework.data.jpa.repository.JpaRepository;

import java.util.List;
import java.util.UUID;

public interface CartridgeEventRepository extends JpaRepository<CartridgeEvent, UUID> {
    List<CartridgeEvent> findByCartridgeIdOrderByCreatedAtDesc(UUID cartridgeId);
}
