package br.com.nexusit.meetings;

import br.com.nexusit.user.User;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import org.springframework.http.HttpStatus;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.*;

import java.util.List;
import java.util.UUID;

@RestController
@RequestMapping("/api/meetings")
@RequiredArgsConstructor
public class MeetingController {

    private final MeetingService service;

    @GetMapping
    public List<MeetingResponse> findAll() {
        return service.findAll();
    }

    @PostMapping
    @ResponseStatus(HttpStatus.CREATED)
    public MeetingResponse create(@Valid @RequestBody MeetingRequest req,
                                   @AuthenticationPrincipal User user) {
        return service.create(req, user);
    }

    @PutMapping("/{id}")
    public MeetingResponse update(@PathVariable UUID id,
                                   @Valid @RequestBody MeetingRequest req,
                                   @AuthenticationPrincipal User user) {
        return service.update(id, req, user);
    }

    @DeleteMapping("/{id}")
    @ResponseStatus(HttpStatus.NO_CONTENT)
    public void delete(@PathVariable UUID id, @AuthenticationPrincipal User user) {
        service.delete(id, user);
    }
}
