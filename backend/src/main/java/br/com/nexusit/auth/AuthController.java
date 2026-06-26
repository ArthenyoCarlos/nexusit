package br.com.nexusit.auth;

import br.com.nexusit.user.User;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.*;
import java.util.Map;

@RestController
@RequestMapping("/api/auth")
@RequiredArgsConstructor
public class AuthController {

    private final AuthService authService;

    @PostMapping("/login")
    public ResponseEntity<AuthResponse> login(@Valid @RequestBody AuthRequest request) {
        return ResponseEntity.ok(authService.login(request));
    }

    @PostMapping("/change-password")
    public ResponseEntity<Map<String,String>> changePassword(
            @AuthenticationPrincipal User user,
            @RequestBody ChangePasswordRequest req) {
        authService.changePassword(user, req);
        return ResponseEntity.ok(Map.of("message", "Senha alterada com sucesso"));
    }
}
