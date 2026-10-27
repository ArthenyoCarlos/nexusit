package br.com.nexusit.support;

import java.time.LocalDateTime;

public record SupportReadResponse(boolean localRead, long unreadCount, String remoteRead, LocalDateTime readAt) {}
