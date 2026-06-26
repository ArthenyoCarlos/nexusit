package br.com.nexusit.email;

import br.com.nexusit.financial.Bill;
import br.com.nexusit.financial.BillRepository;
import br.com.nexusit.licenses.License;
import br.com.nexusit.licenses.LicenseRepository;
import br.com.nexusit.urlmonitor.MonitoredUrl;
import br.com.nexusit.urlmonitor.MonitoredUrlRepository;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.mail.SimpleMailMessage;
import org.springframework.mail.javamail.JavaMailSender;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.stereotype.Service;

import java.time.LocalDate;
import java.time.temporal.ChronoUnit;
import java.util.List;

@Service @RequiredArgsConstructor @Slf4j
public class EmailAlertService {

    private final JavaMailSender mailSender;
    private final LicenseRepository licenseRepo;
    private final BillRepository billRepo;
    private final MonitoredUrlRepository urlRepo;

    @Value("${app.alert-email:}") private String alertEmail;
    @Value("${app.company-name:NexusIT}") private String companyName;

    // Roda todo dia às 08:00
    @Scheduled(cron = "0 0 8 * * *")
    public void dailyAlerts() {
        if (alertEmail == null || alertEmail.isBlank()) return;
        checkLicenses();
        checkBills();
    }

    private void checkLicenses() {
        List<License> expiring = licenseRepo.findExpiringBetween(LocalDate.now(), LocalDate.now().plusDays(30));
        if (expiring.isEmpty()) return;
        StringBuilder sb = new StringBuilder();
        sb.append("As seguintes licenças vencem nos próximos 30 dias:\n\n");
        expiring.forEach(l -> {
            long days = ChronoUnit.DAYS.between(LocalDate.now(), l.getExpiryDate());
            sb.append(String.format("• %s (%s) — vence em %d dias (%s)\n",
                    l.getName(), l.getVendor() != null ? l.getVendor() : "—", days, l.getExpiryDate()));
        });
        send("[" + companyName + "] Licenças a vencer", sb.toString());
    }

    private void checkBills() {
        List<Bill> overdue = billRepo.findByPaidFalseOrderByDueDateAsc().stream()
                .filter(b -> b.getDueDate().isBefore(LocalDate.now()) || ChronoUnit.DAYS.between(LocalDate.now(), b.getDueDate()) <= 3)
                .toList();
        if (overdue.isEmpty()) return;
        StringBuilder sb = new StringBuilder();
        sb.append("Contas a pagar vencidas ou vencendo em até 3 dias:\n\n");
        overdue.forEach(b -> {
            long days = ChronoUnit.DAYS.between(LocalDate.now(), b.getDueDate());
            String status = days < 0 ? "VENCIDA há " + Math.abs(days) + " dias" : "vence em " + days + " dia(s)";
            sb.append(String.format("• %s — R$ %.2f — %s (%s)\n", b.getTitle(), b.getAmount(), status, b.getDueDate()));
        });
        send("[" + companyName + "] Contas a pagar — atenção", sb.toString());
    }

    public void sendUrlDownAlert(MonitoredUrl url) {
        if (alertEmail == null || alertEmail.isBlank()) return;
        send("[" + companyName + "] URL fora do ar: " + url.getName(),
                String.format("A URL monitorada '%s' (%s) retornou status %d.\n\nVerifique o sistema imediatamente.",
                        url.getName(), url.getUrl(), url.getLastStatus()));
    }

    private void send(String subject, String body) {
        try {
            SimpleMailMessage msg = new SimpleMailMessage();
            msg.setTo(alertEmail); msg.setSubject(subject); msg.setText(body);
            mailSender.send(msg);
            log.info("E-mail enviado: {}", subject);
        } catch (Exception e) {
            log.warn("Falha ao enviar e-mail: {}", e.getMessage());
        }
    }
}
