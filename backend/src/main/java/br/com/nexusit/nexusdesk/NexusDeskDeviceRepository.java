package br.com.nexusit.nexusdesk;

import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;

import java.util.List;
import java.util.UUID;

public interface NexusDeskDeviceRepository extends JpaRepository<NexusDeskDevice, UUID> {

    @Query("SELECT d FROM NexusDeskDevice d LEFT JOIN FETCH d.inventoryItem LEFT JOIN FETCH d.createdBy ORDER BY d.name")
    List<NexusDeskDevice> findAllWithRelations();
}
