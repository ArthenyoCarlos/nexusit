package br.com.nexusit.monitoring;

public record UnifiApMetricPoint(long timestamp, Double lossPct, Double rttMs, Integer clientCount) {}
