package br.com.nexusit.auth;

import br.com.nexusit.user.Role;

import java.util.UUID;

public record AuthResponse(
        String token,
        String refreshToken,
        UserInfo user
) {
    public record UserInfo(UUID id, String name, String email, Role role) {}
}
