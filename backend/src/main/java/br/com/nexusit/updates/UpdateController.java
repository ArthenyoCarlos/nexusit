package br.com.nexusit.updates;

import lombok.RequiredArgsConstructor;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

@RestController
@RequestMapping("/api/updates")
@RequiredArgsConstructor
@PreAuthorize("hasRole('ADMIN')")
public class UpdateController {

    private final UpdaterClient updaterClient;

    @GetMapping("/status")
    public UpdateStatus status() {
        return updaterClient.getStatus();
    }

    @PostMapping("/apply")
    public UpdateStatus apply() {
        updaterClient.triggerUpdate();
        return updaterClient.getStatus();
    }
}
