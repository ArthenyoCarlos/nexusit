package br.com.nexusit.auth;

public record ChangePasswordRequest(String currentPassword, String newPassword) {}
