package br.com.nexusit.alerttriage;

import java.util.List;

public record AlertTriageSummary(
        int activeCount,
        int actionableCount,
        int showOnlyCount,
        int ignoredCount,
        int silencedCount,
        int highSeverityCount,
        List<AlertTriageItem> items,
        List<AlertTriageRuleResponse> rules
) {}
