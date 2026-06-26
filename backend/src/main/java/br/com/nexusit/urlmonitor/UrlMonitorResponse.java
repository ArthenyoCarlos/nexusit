package br.com.nexusit.urlmonitor;

import java.math.BigDecimal;
import java.time.LocalDateTime;
import java.util.UUID;

public record UrlMonitorResponse(
        UUID id,
        String name,
        String url,
        boolean enabled,
        int intervalSec,
        LocalDateTime lastCheck,
        Integer lastStatus,
        LocalDateTime lastOk,
        BigDecimal uptimePct,
        boolean up,
        LocalDateTime createdAt
) {
    public static UrlMonitorResponse from(MonitoredUrl m) {
        boolean up = m.getLastStatus() != null && m.getLastStatus() >= 200 && m.getLastStatus() < 400;
        return new UrlMonitorResponse(
                m.getId(), m.getName(), m.getUrl(),
                Boolean.TRUE.equals(m.getEnabled()),
                m.getIntervalSec() != null ? m.getIntervalSec() : 300,
                m.getLastCheck(), m.getLastStatus(), m.getLastOk(),
                m.getUptimePct(), up, m.getCreatedAt()
        );
    }
}
