package br.com.nexusit.planning;

import br.com.nexusit.user.UserRepository;
import jakarta.persistence.EntityNotFoundException;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.List;
import java.util.UUID;

@Service
@RequiredArgsConstructor
@Transactional(readOnly = true)
public class PlanningTaskService {

    private final PlanningTaskRepository repository;
    private final UserRepository userRepository;

    public List<PlanningTaskResponse> findAll() {
        return repository.findAllWithAssignee().stream()
                .map(PlanningTaskResponse::from).toList();
    }

    @Transactional
    public PlanningTaskResponse create(PlanningTaskRequest req) {
        PlanningTask task = toEntity(new PlanningTask(), req);
        return PlanningTaskResponse.from(repository.save(task));
    }

    @Transactional
    public PlanningTaskResponse update(UUID id, PlanningTaskRequest req) {
        PlanningTask task = findOrThrow(id);
        return PlanningTaskResponse.from(repository.save(toEntity(task, req)));
    }

    @Transactional
    public PlanningTaskResponse move(UUID id, MoveRequest req) {
        PlanningTask task = findOrThrow(id);
        task.setColumnName(req.columnName());
        task.setColumnOrder(req.columnOrder());
        return PlanningTaskResponse.from(repository.save(task));
    }

    @Transactional
    public void delete(UUID id) {
        if (!repository.existsById(id))
            throw new EntityNotFoundException("Tarefa não encontrada: " + id);
        repository.deleteById(id);
    }

    private PlanningTask toEntity(PlanningTask task, PlanningTaskRequest req) {
        task.setTitle(req.title());
        task.setDescription(req.description());
        task.setColumnName(req.columnName() != null ? req.columnName() : "Backlog");
        task.setColumnOrder(req.columnOrder() != null ? req.columnOrder() : 0);
        task.setDueDate(req.dueDate());
        task.setAssignee(req.assigneeId() != null
                ? userRepository.findById(req.assigneeId()).orElse(null) : null);
        return task;
    }

    private PlanningTask findOrThrow(UUID id) {
        return repository.findById(id)
                .orElseThrow(() -> new EntityNotFoundException("Tarefa não encontrada: " + id));
    }
}
