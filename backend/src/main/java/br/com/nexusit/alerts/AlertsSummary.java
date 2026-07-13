package br.com.nexusit.alerts;

import java.util.List;

public record AlertsSummary(int criticalCount, int warningCount, List<AlertItem> items) {}
