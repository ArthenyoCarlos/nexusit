package br.com.nexusit.user;

import java.util.UUID;

public record UserSummary(UUID id, String name, String email, Role role, String jobTitle, boolean active) {
    public static UserSummary from(User user) {
        return new UserSummary(
                user.getId(),
                user.getName(),
                user.getEmail(),
                user.getRole(),
                UserController.normalizeJobTitle(user.getJobTitle(), user.getRole()),
                user.isActive()
        );
    }
}
