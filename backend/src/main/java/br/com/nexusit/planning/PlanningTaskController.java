package br.com.nexusit.planning;

import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import org.springframework.http.HttpStatus;
import org.springframework.web.bind.annotation.*;

import java.util.List;
import java.util.UUID;

@RestController
@RequestMapping("/api/planning/tasks")
@RequiredArgsConstructor
public class PlanningTaskController {

    private final PlanningTaskService service;

    @GetMapping
    public List<PlanningTaskResponse> findAll() {
        return service.findAll();
    }

    @PostMapping
    @ResponseStatus(HttpStatus.CREATED)
    public PlanningTaskResponse create(@Valid @RequestBody PlanningTaskRequest req) {
        return service.create(req);
    }

    @PutMapping("/{id}")
    public PlanningTaskResponse update(@PathVariable UUID id,
                                       @Valid @RequestBody PlanningTaskRequest req) {
        return service.update(id, req);
    }

    @PutMapping("/{id}/move")
    public PlanningTaskResponse move(@PathVariable UUID id,
                                     @RequestBody MoveRequest req) {
        return service.move(id, req);
    }

    @DeleteMapping("/{id}")
    @ResponseStatus(HttpStatus.NO_CONTENT)
    public void delete(@PathVariable UUID id) {
        service.delete(id);
    }
}
