package br.com.nexusit.alerts;

public record AlertItem(String type, String severity, String message, String path) {}
