package br.com.nexusit.auth;

import br.com.nexusit.user.User;
import br.com.nexusit.user.UserRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.security.authentication.AuthenticationManager;
import org.springframework.security.authentication.BadCredentialsException;
import org.springframework.security.authentication.UsernamePasswordAuthenticationToken;
import org.springframework.security.core.userdetails.UsernameNotFoundException;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.stereotype.Service;

@Service
@RequiredArgsConstructor
public class AuthService {

    private final AuthenticationManager authenticationManager;
    private final JwtService jwtService;
    private final UserRepository userRepository;
    private final PasswordEncoder passwordEncoder;

    public AuthResponse login(AuthRequest request) {
        authenticationManager.authenticate(
                new UsernamePasswordAuthenticationToken(request.email(), request.password())
        );

        User user = userRepository.findByEmail(request.email())
                .orElseThrow(() -> new UsernameNotFoundException("Usuário não encontrado"));

        String token = jwtService.generateToken(user);
        String refreshToken = jwtService.generateRefreshToken(user);

        return new AuthResponse(
                token,
                refreshToken,
                new AuthResponse.UserInfo(user.getId(), user.getName(), user.getEmail(), user.getRole())
        );
    }

    public void changePassword(User user, ChangePasswordRequest req) {
        if (!passwordEncoder.matches(req.currentPassword(), user.getPasswordHash()))
            throw new BadCredentialsException("Senha atual incorreta");
        if (req.newPassword() == null || req.newPassword().length() < 6)
            throw new IllegalArgumentException("Nova senha deve ter ao menos 6 caracteres");
        user.setPasswordHash(passwordEncoder.encode(req.newPassword()));
        userRepository.save(user);
    }
}
