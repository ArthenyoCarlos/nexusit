package br.com.nexusit.monitoring;

import java.util.List;

public record UnifiApInstabilitySummary(
        int totalAps,
        int unstableCount,
        int ticketRecommendedCount,
        int downWindows24h,
        int estimatedOfflineMinutes24h,
        List<UnifiApInstabilityItem> items
) {}
