package br.com.nexusit.cartridge;

import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;

import java.util.List;
import java.util.Optional;
import java.util.UUID;

public interface CartridgeRepository extends JpaRepository<Cartridge, UUID> {
    List<Cartridge> findAllByOrderByUpdatedAtDesc();
    Optional<Cartridge> findByCode(String code);

    @Query(value = "SELECT nextval('cartridge_code_seq')", nativeQuery = true)
    long nextCodeSequence();
}
