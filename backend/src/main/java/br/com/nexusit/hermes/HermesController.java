package br.com.nexusit.hermes;

import br.com.nexusit.contracts.ContractRepository;
import br.com.nexusit.inventory.InventoryRepository;
import br.com.nexusit.inventory.ItemStatus;
import br.com.nexusit.licenses.LicenseRepository;
import br.com.nexusit.onboarding.ChecklistRepository;
import br.com.nexusit.urlmonitor.MonitoredUrlRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

import java.time.LocalDate;
import java.util.ArrayList;
import java.util.List;

@RestController
@RequestMapping("/api/hermes")
@RequiredArgsConstructor
public class HermesController {

    private final LicenseRepository licenseRepo;
    private final ContractRepository contractRepo;
    private final InventoryRepository inventoryRepo;
    private final MonitoredUrlRepository urlRepo;
    private final ChecklistRepository checklistRepo;

    @GetMapping("/summary")
    public HermesSummary getSummary() {
        LocalDate today = LocalDate.now();
        LocalDate in30  = today.plusDays(30);
        LocalDate in90  = today.plusDays(90);

        List<AttentionItem> attention = new ArrayList<>();

        // ── Licenses ────────────────────────────────────────────────────────────
        var allLicenses = licenseRepo.findAll();
        long expiredLicenses  = allLicenses.stream()
                .filter(l -> l.getExpiryDate() != null && l.getExpiryDate().isBefore(today)).count();
        long expiring30Lics   = allLicenses.stream()
                .filter(l -> l.getExpiryDate() != null && !l.getExpiryDate().isBefore(today) && l.getExpiryDate().isBefore(in30)).count();
        long expiring90Lics   = allLicenses.stream()
                .filter(l -> l.getExpiryDate() != null && !l.getExpiryDate().isBefore(in30) && l.getExpiryDate().isBefore(in90)).count();

        if (expiredLicenses > 0)
            attention.add(new AttentionItem("license", "critical",
                    expiredLicenses + " licença(s) vencida(s) — renovação urgente", "/licenses"));
        if (expiring30Lics > 0)
            attention.add(new AttentionItem("license", "warning",
                    expiring30Lics + " licença(s) vencem em até 30 dias", "/licenses"));
        if (expiring90Lics > 0)
            attention.add(new AttentionItem("license", "info",
                    expiring90Lics + " licença(s) vencem em até 90 dias", "/licenses"));

        // ── Contracts ───────────────────────────────────────────────────────────
        var allContracts = contractRepo.findAll();
        long expiredContracts  = allContracts.stream()
                .filter(c -> c.getEndDate() != null && c.getEndDate().isBefore(today)).count();
        long expiring30Ctrs    = allContracts.stream()
                .filter(c -> c.getEndDate() != null && !c.getEndDate().isBefore(today) && c.getEndDate().isBefore(in30)).count();
        long expiring90Ctrs    = allContracts.stream()
                .filter(c -> c.getEndDate() != null && !c.getEndDate().isBefore(in30) && c.getEndDate().isBefore(in90)).count();

        if (expiredContracts > 0)
            attention.add(new AttentionItem("contract", "critical",
                    expiredContracts + " contrato(s) vencido(s) — ação necessária", "/contracts"));
        if (expiring30Ctrs > 0)
            attention.add(new AttentionItem("contract", "warning",
                    expiring30Ctrs + " contrato(s) vencem em até 30 dias", "/contracts"));
        if (expiring90Ctrs > 0)
            attention.add(new AttentionItem("contract", "info",
                    expiring90Ctrs + " contrato(s) vencem em até 90 dias", "/contracts"));

        // ── Inventory ───────────────────────────────────────────────────────────
        var allInventory = inventoryRepo.findAll();
        long inventoryActive      = allInventory.stream().filter(i -> i.getStatus() == ItemStatus.ACTIVE).count();
        long inventoryMaintenance = allInventory.stream().filter(i -> i.getStatus() == ItemStatus.MAINTENANCE).count();
        long inventoryInactive    = allInventory.stream().filter(i -> i.getStatus() == ItemStatus.INACTIVE).count();
        long noTombamento         = allInventory.stream().filter(i -> i.getTombamento() == null || i.getTombamento().isBlank()).count();

        if (inventoryMaintenance > 0)
            attention.add(new AttentionItem("inventory", "warning",
                    inventoryMaintenance + " ativo(s) em manutenção", "/inventory"));
        if (noTombamento > 0)
            attention.add(new AttentionItem("inventory", "info",
                    noTombamento + " ativo(s) sem tombamento registrado", "/inventory"));

        // ── URL Monitor ─────────────────────────────────────────────────────────
        var allUrls = urlRepo.findAll();
        long urlsEnabled = allUrls.stream().filter(u -> Boolean.TRUE.equals(u.getEnabled())).count();
        long urlsDown    = allUrls.stream()
                .filter(u -> Boolean.TRUE.equals(u.getEnabled()) && u.getLastStatus() != null && u.getLastStatus() >= 400).count();
        long urlsNoCheck = allUrls.stream()
                .filter(u -> Boolean.TRUE.equals(u.getEnabled()) && u.getLastStatus() == null).count();

        if (urlsDown > 0)
            attention.add(new AttentionItem("url", "critical",
                    urlsDown + " URL(s) monitorada(s) com falha", "/url-monitor"));

        // ── Onboarding ──────────────────────────────────────────────────────────
        long activeOnboardings = checklistRepo.count();

        // ── Health score (DB data only; frontend adds Zabbix/GLPI) ──────────────
        int score = 100;
        score -= (int) Math.min(expiredLicenses  * 8, 24);
        score -= (int) Math.min(expiring30Lics   * 3, 9);
        score -= (int) Math.min(expiredContracts * 8, 24);
        score -= (int) Math.min(expiring30Ctrs   * 3, 9);
        score -= (int) Math.min(urlsDown         * 12, 36);
        score  = Math.max(0, Math.min(score, 100));

        return new HermesSummary(
                score,
                attention,
                (int) expiredLicenses,  (int) expiring30Lics,  (int) expiring90Lics,
                (int) expiredContracts, (int) expiring30Ctrs,  (int) expiring90Ctrs,
                (int) allInventory.size(), (int) inventoryActive, (int) inventoryMaintenance, (int) inventoryInactive,
                (int) urlsEnabled, (int) urlsDown, (int) urlsNoCheck,
                (int) activeOnboardings
        );
    }

    public record AttentionItem(String type, String severity, String message, String path) {}

    public record HermesSummary(
            int scoreBase,
            List<AttentionItem> attentionItems,
            int expiredLicenses,  int expiring30Licenses,  int expiring90Licenses,
            int expiredContracts, int expiring30Contracts, int expiring90Contracts,
            int inventoryTotal,   int inventoryActive,     int inventoryMaintenance, int inventoryInactive,
            int urlsTotal,        int urlsDown,            int urlsNoCheck,
            int activeOnboardings
    ) {}
}
