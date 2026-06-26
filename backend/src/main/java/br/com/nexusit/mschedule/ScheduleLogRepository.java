package br.com.nexusit.mschedule;

import org.springframework.data.jpa.repository.JpaRepository;
import java.util.List;
import java.util.UUID;

public interface ScheduleLogRepository extends JpaRepository<MaintenanceScheduleLog, UUID> {
    List<MaintenanceScheduleLog> findByScheduleIdOrderByCompletedAtDesc(UUID scheduleId);
}
