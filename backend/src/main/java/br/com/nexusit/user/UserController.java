package br.com.nexusit.user;

import jakarta.validation.Valid;
import jakarta.validation.constraints.Email;
import jakarta.validation.constraints.NotBlank;
import lombok.RequiredArgsConstructor;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.web.bind.annotation.*;
import org.springframework.web.server.ResponseStatusException;

import java.util.List;
import java.util.UUID;

@RestController
@RequestMapping("/api/users")
@RequiredArgsConstructor
public class UserController {

    private final UserRepository userRepository;
    private final PasswordEncoder passwordEncoder;

    @GetMapping
    public List<UserSummary> listAll() {
        return userRepository.findAll().stream()
                .map(UserSummary::from)
                .toList();
    }

    @GetMapping("/me")
    public UserSummary getProfile(@AuthenticationPrincipal User user) {
        return UserSummary.from(user);
    }

    @PutMapping("/me")
    public UserSummary updateProfile(
            @RequestBody UpdateProfileRequest req,
            @AuthenticationPrincipal User currentUser
    ) {
        User user = userRepository.findById(currentUser.getId())
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND));

        if (req.name() != null && !req.name().isBlank()) {
            user.setName(req.name().trim());
        }
        if (req.newPassword() != null && !req.newPassword().isBlank()) {
            if (req.currentPassword() == null || !passwordEncoder.matches(req.currentPassword(), user.getPasswordHash())) {
                throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Senha atual incorreta");
            }
            user.setPasswordHash(passwordEncoder.encode(req.newPassword()));
        }
        return UserSummary.from(userRepository.save(user));
    }

    @PostMapping
    @PreAuthorize("hasRole('ADMIN')")
    public ResponseEntity<UserSummary> create(@Valid @RequestBody CreateUserRequest req) {
        if (userRepository.existsByEmail(req.email())) {
            throw new ResponseStatusException(HttpStatus.CONFLICT, "Email já cadastrado");
        }
        User user = User.builder()
                .name(req.name())
                .email(req.email())
                .passwordHash(passwordEncoder.encode(req.password()))
                .role(req.role() != null ? req.role() : Role.TECHNICIAN)
                .active(true)
                .build();
        return ResponseEntity.status(HttpStatus.CREATED).body(UserSummary.from(userRepository.save(user)));
    }

    @PutMapping("/{id}")
    @PreAuthorize("hasRole('ADMIN')")
    public UserSummary update(@PathVariable UUID id, @RequestBody UpdateUserRequest req) {
        User user = userRepository.findById(id)
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND));
        if (req.name() != null && !req.name().isBlank()) user.setName(req.name().trim());
        if (req.role() != null) user.setRole(req.role());
        if (req.active() != null) user.setActive(req.active());
        if (req.password() != null && !req.password().isBlank()) {
            user.setPasswordHash(passwordEncoder.encode(req.password()));
        }
        return UserSummary.from(userRepository.save(user));
    }

    @DeleteMapping("/{id}")
    @PreAuthorize("hasRole('ADMIN')")
    public ResponseEntity<Void> delete(@PathVariable UUID id) {
        if (!userRepository.existsById(id)) throw new ResponseStatusException(HttpStatus.NOT_FOUND);
        userRepository.deleteById(id);
        return ResponseEntity.noContent().build();
    }

    // ── Records ────────────────────────────────────────────────────────────────

    public record UserSummary(UUID id, String name, String email, Role role, boolean active) {
        public static UserSummary from(User u) {
            return new UserSummary(u.getId(), u.getName(), u.getEmail(), u.getRole(), u.isActive());
        }
    }

    public record UpdateProfileRequest(String name, String currentPassword, String newPassword) {}

    public record CreateUserRequest(
            @NotBlank String name,
            @NotBlank @Email String email,
            @NotBlank String password,
            Role role
    ) {}

    public record UpdateUserRequest(String name, Role role, Boolean active, String password) {}
}
