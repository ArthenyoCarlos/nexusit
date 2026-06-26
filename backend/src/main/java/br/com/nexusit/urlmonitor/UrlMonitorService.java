package br.com.nexusit.urlmonitor;

import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.data.domain.PageRequest;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.math.BigDecimal;
import java.math.RoundingMode;
import java.net.HttpURLConnection;
import java.net.URL;
import java.time.LocalDateTime;
import java.util.List;
import java.util.UUID;

@Slf4j
@Service
@RequiredArgsConstructor
@Transactional(readOnly = true)
public class UrlMonitorService {

    private final MonitoredUrlRepository monitorRepo;
    private final UrlCheckResultRepository checkRepo;

    public List<UrlMonitorResponse> findAll() {
        return monitorRepo.findAllByOrderByNameAsc().stream().map(UrlMonitorResponse::from).toList();
    }

    public List<UrlCheckResult> getHistory(UUID id) {
        return checkRepo.findTop50ByMonitorId(id, PageRequest.of(0, 50));
    }

    @Transactional
    public UrlMonitorResponse create(UrlMonitorRequest req) {
        MonitoredUrl m = MonitoredUrl.builder()
                .name(req.name()).url(req.url())
                .enabled(req.enabled() != null ? req.enabled() : true)
                .intervalSec(req.intervalSec() != null ? req.intervalSec() : 300)
                .build();
        return UrlMonitorResponse.from(monitorRepo.save(m));
    }

    @Transactional
    public UrlMonitorResponse update(UUID id, UrlMonitorRequest req) {
        MonitoredUrl m = monitorRepo.findById(id)
                .orElseThrow(() -> new jakarta.persistence.EntityNotFoundException("Monitor não encontrado"));
        m.setName(req.name()); m.setUrl(req.url());
        if (req.enabled() != null) m.setEnabled(req.enabled());
        if (req.intervalSec() != null) m.setIntervalSec(req.intervalSec());
        return UrlMonitorResponse.from(monitorRepo.save(m));
    }

    @Transactional
    public void delete(UUID id) {
        if (!monitorRepo.existsById(id))
            throw new jakarta.persistence.EntityNotFoundException("Monitor não encontrado");
        monitorRepo.deleteById(id);
    }

    @Transactional
    public UrlMonitorResponse checkNow(UUID id) {
        MonitoredUrl m = monitorRepo.findById(id)
                .orElseThrow(() -> new jakarta.persistence.EntityNotFoundException("Monitor não encontrado"));
        performCheck(m);
        return UrlMonitorResponse.from(monitorRepo.save(m));
    }

    @Scheduled(fixedDelay = 60000)
    @Transactional
    public void scheduledCheck() {
        List<MonitoredUrl> monitors = monitorRepo.findByEnabledTrueOrderByNameAsc();
        LocalDateTime now = LocalDateTime.now();
        for (MonitoredUrl m : monitors) {
            if (m.getLastCheck() == null ||
                    m.getLastCheck().plusSeconds(m.getIntervalSec()).isBefore(now)) {
                try {
                    performCheck(m);
                    monitorRepo.save(m);
                } catch (Exception e) {
                    log.warn("Erro ao verificar URL {}: {}", m.getUrl(), e.getMessage());
                }
            }
        }
    }

    private void performCheck(MonitoredUrl m) {
        long start = System.currentTimeMillis();
        int statusCode = 0;
        try {
            HttpURLConnection conn = (HttpURLConnection) new URL(m.getUrl()).openConnection();
            conn.setConnectTimeout(8000);
            conn.setReadTimeout(8000);
            conn.setRequestMethod("GET");
            conn.setInstanceFollowRedirects(true);
            statusCode = conn.getResponseCode();
            conn.disconnect();
        } catch (Exception e) {
            statusCode = 0;
        }
        int ms = (int) (System.currentTimeMillis() - start);
        boolean ok = statusCode >= 200 && statusCode < 400;

        m.setLastCheck(LocalDateTime.now());
        m.setLastStatus(statusCode);
        if (ok) m.setLastOk(LocalDateTime.now());

        UrlCheckResult result = UrlCheckResult.builder()
                .monitor(m).checkedAt(LocalDateTime.now())
                .statusCode(statusCode).responseMs(ms).ok(ok)
                .build();
        checkRepo.save(result);

        // recalculate uptime from last 50 checks
        List<UrlCheckResult> history = checkRepo.findTop50ByMonitorId(m.getId(), PageRequest.of(0, 50));
        if (!history.isEmpty()) {
            long okCount = history.stream().filter(r -> Boolean.TRUE.equals(r.getOk())).count();
            m.setUptimePct(BigDecimal.valueOf(okCount * 100.0 / history.size()).setScale(2, RoundingMode.HALF_UP));
        }
    }
}
