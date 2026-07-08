package br.com.nexusit.support;

import org.springframework.data.jpa.repository.JpaRepository;

import java.util.Optional;
import java.util.UUID;

public interface WhatsappContactRepository extends JpaRepository<WhatsappContact, UUID> {
    Optional<WhatsappContact> findByPhoneNumber(String phoneNumber);
}
