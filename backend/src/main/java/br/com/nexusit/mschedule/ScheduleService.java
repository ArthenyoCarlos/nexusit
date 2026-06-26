package br.com.nexusit.mschedule;

import br.com.nexusit.user.User;
import br.com.nexusit.user.UserRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;
import java.time.LocalDate;
import java.util.List;
import java.util.UUID;

@Service @RequiredArgsConstructor
public class ScheduleService {
    private final ScheduleRepository repo;
    private final ScheduleLogRepository logRepo;
    private final UserRepository userRepo;

    public List<ScheduleResponse> findAll() {
        return repo.findByActiveTrueOrderByNextDueAsc().stream().map(ScheduleResponse::from).toList();
    }

    public ScheduleResponse create(ScheduleRequest req, User user) {
        User assignedTo = req.assignedToId() != null ? userRepo.findById(req.assignedToId()).orElse(null) : null;
        MaintenanceSchedule s = MaintenanceSchedule.builder()
                .title(req.title()).description(req.description())
                .recurrence(req.recurrence() != null ? req.recurrence() : "MONTHLY")
                .nextDue(req.nextDue()).assignedTo(assignedTo).active(true).createdBy(user).build();
        return ScheduleResponse.from(repo.save(s));
    }

    public ScheduleResponse complete(UUID id, String notes, User user) {
        MaintenanceSchedule s = repo.findById(id).orElseThrow();
        MaintenanceScheduleLog log = MaintenanceScheduleLog.builder()
                .schedule(s).completedAt(LocalDate.now()).notes(notes).completedBy(user).build();
        logRepo.save(log);
        s.setNextDue(nextDueDate(s.getNextDue(), s.getRecurrence()));
        return ScheduleResponse.from(repo.save(s));
    }

    public void delete(UUID id) { repo.findById(id).ifPresent(s -> { s.setActive(false); repo.save(s); }); }

    private LocalDate nextDueDate(LocalDate from, String rec) {
        if (from == null) from = LocalDate.now();
        return switch (rec) {
            case "DAILY"     -> from.plusDays(1);
            case "WEEKLY"    -> from.plusWeeks(1);
            case "QUARTERLY" -> from.plusMonths(3);
            case "YEARLY"    -> from.plusYears(1);
            default          -> from.plusMonths(1);
        };
    }
}
