package br.com.nexusit.support;

import java.time.LocalDateTime;
import java.util.List;

public record SupportDashboardResponse(
        LocalDateTime generatedAt,
        int windowDays,
        Metrics metrics,
        List<CountItem> byState,
        List<CountItem> byCategory,
        List<CountItem> byTechnician,
        List<AttentionItem> attention,
        List<SupportConversationSummary> recent
) {
    public record Metrics(
            long total,
            long today,
            long queue,
            long active,
            long closed,
            long awaitingUser,
            long withTicket,
            long messages24h,
            long avgWaitMinutes,
            long oldestQueueMinutes
    ) {}

    public record CountItem(String key, String label, long count, String tone) {}

    public record AttentionItem(
            String id,
            String title,
            String subtitle,
            String tone,
            Long ageMinutes,
            SupportConversationSummary conversation
    ) {}
}
