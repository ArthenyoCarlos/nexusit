package br.com.nexusit.push;

import br.com.nexusit.user.User;
import jakarta.validation.Valid;
import jakarta.validation.constraints.NotBlank;
import lombok.RequiredArgsConstructor;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.*;

import java.time.LocalDateTime;

@RestController
@RequestMapping("/api/devices")
@RequiredArgsConstructor
public class DeviceTokenController {

    private final DeviceTokenRepository repo;

    @PostMapping("/register")
    public void register(@Valid @RequestBody DeviceTokenRequest req, @AuthenticationPrincipal User user) {
        DeviceToken token = repo.findByToken(req.token()).orElseGet(() -> DeviceToken.builder()
                .token(req.token())
                .build());
        token.setUser(user);
        token.setPlatform(req.platform() == null || req.platform().isBlank() ? "android" : req.platform());
        token.setLastSeenAt(LocalDateTime.now());
        repo.save(token);
    }

    @PostMapping("/unregister")
    public void unregister(@Valid @RequestBody DeviceTokenRequest req) {
        repo.deleteByToken(req.token());
    }

    public record DeviceTokenRequest(@NotBlank String token, String platform) {}
}
