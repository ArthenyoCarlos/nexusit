package br.com.nexusit.mschedule;

import org.springframework.data.jpa.repository.JpaRepository;
import java.util.List;
import java.util.UUID;

public interface ScheduleRepository extends JpaRepository<MaintenanceSchedule, UUID> {
    List<MaintenanceSchedule> findByActiveTrueOrderByNextDueAsc();
}
