package br.com.nexusit.maintenance;

import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

import java.util.List;
import java.util.UUID;

public interface MaintenanceRepository extends JpaRepository<MaintenanceRecord, UUID> {

    @Query("SELECT m FROM MaintenanceRecord m LEFT JOIN FETCH m.performedBy WHERE m.inventoryItem.id = :id ORDER BY m.performedAt DESC")
    List<MaintenanceRecord> findByInventoryItemId(@Param("id") UUID id);
}
