package br.com.nexusit.reports;

import br.com.nexusit.audit.AuditEvent;
import br.com.nexusit.audit.AuditEventRepository;
import br.com.nexusit.contracts.Contract;
import br.com.nexusit.contracts.ContractRepository;
import br.com.nexusit.contracts.ContractResponse;
import br.com.nexusit.financial.Bill;
import br.com.nexusit.financial.BillRepository;
import br.com.nexusit.glpi.GlpiService;
import br.com.nexusit.glpi.GlpiTicket;
import br.com.nexusit.inventory.InventoryItem;
import br.com.nexusit.inventory.InventoryRepository;
import br.com.nexusit.licenses.License;
import br.com.nexusit.licenses.LicenseRepository;
import br.com.nexusit.licenses.LicenseResponse;
import br.com.nexusit.monitoring.ZabbixProblem;
import br.com.nexusit.monitoring.ZabbixService;
import br.com.nexusit.planning.PlanningTask;
import br.com.nexusit.planning.PlanningTaskRepository;
import br.com.nexusit.support.ConversationState;
import br.com.nexusit.support.SupportConversation;
import br.com.nexusit.support.SupportConversationRepository;
import br.com.nexusit.urlmonitor.MonitoredUrl;
import br.com.nexusit.urlmonitor.MonitoredUrlRepository;
import br.com.nexusit.user.User;
import com.itextpdf.io.font.constants.StandardFonts;
import com.itextpdf.kernel.colors.ColorConstants;
import com.itextpdf.kernel.colors.DeviceRgb;
import com.itextpdf.kernel.font.PdfFont;
import com.itextpdf.kernel.font.PdfFontFactory;
import com.itextpdf.kernel.geom.PageSize;
import com.itextpdf.kernel.pdf.PdfDocument;
import com.itextpdf.kernel.pdf.PdfWriter;
import com.itextpdf.layout.Document;
import com.itextpdf.layout.element.Cell;
import com.itextpdf.layout.element.Paragraph;
import com.itextpdf.layout.element.Table;
import com.itextpdf.layout.properties.UnitValue;
import lombok.RequiredArgsConstructor;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Service;

import java.io.ByteArrayOutputStream;
import java.math.BigDecimal;
import java.time.LocalDate;
import java.time.LocalDateTime;
import java.time.format.DateTimeFormatter;
import java.time.format.DateTimeParseException;
import java.time.temporal.ChronoUnit;
import java.util.ArrayList;
import java.util.Comparator;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.UUID;

@Service
@RequiredArgsConstructor
public class ReportService {

    private final GlpiService glpiService;
    private final BillRepository billRepo;
    private final InventoryRepository inventoryRepo;
    private final LicenseRepository licenseRepo;
    private final ContractRepository contractRepo;
    private final AuditEventRepository auditEventRepo;
    private final SupportConversationRepository conversationRepo;
    private final PlanningTaskRepository planningTaskRepo;
    private final MonitoredUrlRepository monitoredUrlRepo;
    private final ZabbixService zabbixService;

    @Value("${app.company-name:Armazém Galdino}")
    private String companyName;

    private static final DateTimeFormatter DATE_FMT = DateTimeFormatter.ofPattern("dd/MM/yyyy");
    private static final DateTimeFormatter DATETIME_FMT = DateTimeFormatter.ofPattern("dd/MM HH:mm");
    private static final DateTimeFormatter GLPI_DATETIME_FMT = DateTimeFormatter.ofPattern("yyyy-MM-dd HH:mm:ss");
    private static final String DONE_COLUMN = "Concluído";

    // ── Relatório de Chamados (GLPI) ─────────────────────────────────────────

    public byte[] ticketsReport(int days) {
        LocalDateTime since = LocalDateTime.now().minusDays(Math.max(1, days));

        List<GlpiTicket> all = new java.util.ArrayList<>();
        all.addAll(glpiService.getTickets(null)); // abertos (status 1-4)
        all.addAll(glpiService.getTickets(5));    // resolvidos
        all.addAll(glpiService.getTickets(6));    // fechados

        List<GlpiTicket> tickets = all.stream()
                .filter(t -> {
                    LocalDateTime opened = parseGlpiDate(t.openedAt());
                    return opened != null && !opened.isBefore(since);
                })
                .toList();

        long open = tickets.stream().filter(t -> t.status() <= 4).count();
        long done = tickets.size() - open;

        Map<String, Long> byPriority = new LinkedHashMap<>();
        tickets.forEach(t -> byPriority.merge(t.priorityLabel(), 1L, Long::sum));

        Map<String, Long> byTechnician = new LinkedHashMap<>();
        tickets.forEach(t -> {
            String tech = (t.assignedTo() == null || t.assignedTo().isBlank()) ? "Sem técnico" : t.assignedTo();
            byTechnician.merge(tech, 1L, Long::sum);
        });

        List<Long> resolutionMinutes = tickets.stream()
                .map(t -> {
                    LocalDateTime opened = parseGlpiDate(t.openedAt());
                    LocalDateTime solved = parseGlpiDate(t.solvedAt());
                    if (opened == null || solved == null) return null;
                    return ChronoUnit.MINUTES.between(opened, solved);
                })
                .filter(m -> m != null && m >= 0)
                .toList();
        Double avgMinutes = resolutionMinutes.isEmpty() ? null
                : resolutionMinutes.stream().mapToLong(Long::longValue).average().orElse(0);

        ReportPdf pdf = newPdf("Relatório de Chamados — últimos " + days + " dia(s)");
        Document doc = pdf.doc;

        doc.add(kpiLine(pdf, String.format("Total no período: %d | Em aberto: %d | Concluídos: %d", tickets.size(), open, done)));
        if (avgMinutes != null) {
            doc.add(kpiLine(pdf, "Tempo médio até a resolução: " + formatMinutes(avgMinutes.longValue())));
        }

        doc.add(sectionTitle(pdf, "Por prioridade"));
        doc.add(twoColTable(pdf, "Prioridade", "Qtde", byPriority));

        doc.add(sectionTitle(pdf, "Por técnico"));
        doc.add(twoColTable(pdf, "Técnico", "Chamados", topEntries(byTechnician, 10)));

        return finish(pdf);
    }

    // ── Relatório Financeiro ─────────────────────────────────────────────────

    public byte[] financialReport(int months) {
        LocalDate since = LocalDate.now().minusMonths(Math.max(1, months));
        List<Bill> bills = billRepo.findAllByOrderByDueDateAsc().stream()
                .filter(b -> !b.getDueDate().isBefore(since))
                .toList();

        BigDecimal totalPaid = sum(bills.stream().filter(Bill::isPaid));
        BigDecimal totalPending = sum(bills.stream().filter(b -> !b.isPaid()));
        BigDecimal totalOverdue = sum(bills.stream().filter(b -> !b.isPaid() && b.getDueDate().isBefore(LocalDate.now())));

        Map<String, BigDecimal> byCategory = new LinkedHashMap<>();
        bills.forEach(b -> byCategory.merge(
                b.getCategory() != null && !b.getCategory().isBlank() ? b.getCategory() : "Outros",
                b.getAmount(), BigDecimal::add));

        BigDecimal totalLicenses = sum2(licenseRepo.findAll().stream().map(License::getValue));
        BigDecimal totalContracts = sum2(contractRepo.findAll().stream().map(Contract::getValue));

        ReportPdf pdf = newPdf("Relatório Financeiro — últimos " + months + " mês(es)");
        Document doc = pdf.doc;

        doc.add(kpiLine(pdf, "Pago no período: R$ " + fmtMoney(totalPaid)
                + " | Pendente: R$ " + fmtMoney(totalPending)
                + " | Vencido: R$ " + fmtMoney(totalOverdue)));
        doc.add(kpiLine(pdf, "Valor total em licenças: R$ " + fmtMoney(totalLicenses)
                + " | Valor total em contratos: R$ " + fmtMoney(totalContracts)));

        doc.add(sectionTitle(pdf, "Contas por categoria"));
        Table table = new Table(new float[]{3, 2});
        table.setWidth(UnitValue.createPercentValue(100));
        table.addHeaderCell(headerCell(pdf, "Categoria"));
        table.addHeaderCell(headerCell(pdf, "Total (R$)"));
        byCategory.forEach((k, v) -> {
            table.addCell(bodyCell(pdf, k));
            table.addCell(bodyCell(pdf, fmtMoney(v)));
        });
        doc.add(table.setMarginBottom(16));

        return finish(pdf);
    }

    // ── Relatório de Licenças e Contratos ────────────────────────────────────

    public byte[] licensesContractsReport() {
        List<LicenseResponse> licenses = licenseRepo.findAll().stream().map(LicenseResponse::from).toList();
        List<ContractResponse> contracts = contractRepo.findAll().stream().map(ContractResponse::from).toList();

        BigDecimal totalLicenses = sum2(licenses.stream().map(LicenseResponse::value));
        BigDecimal totalContracts = sum2(contracts.stream().map(ContractResponse::value));

        ReportPdf pdf = newPdf("Relatório de Licenças e Contratos");
        Document doc = pdf.doc;

        doc.add(kpiLine(pdf, licenses.size() + " licença(s), valor total R$ " + fmtMoney(totalLicenses)
                + " | " + contracts.size() + " contrato(s), valor total R$ " + fmtMoney(totalContracts)));

        doc.add(sectionTitle(pdf, "Licenças"));
        Table lTable = new Table(new float[]{3, 2, 2, 2});
        lTable.setWidth(UnitValue.createPercentValue(100));
        for (String h : List.of("Nome", "Fornecedor", "Vencimento", "Status"))
            lTable.addHeaderCell(headerCell(pdf, h));
        licenses.stream()
                .sorted(Comparator.comparing(LicenseResponse::daysUntilExpiry))
                .forEach(l -> {
                    lTable.addCell(bodyCell(pdf, l.name()));
                    lTable.addCell(bodyCell(pdf, l.vendor() != null ? l.vendor() : "—"));
                    lTable.addCell(bodyCell(pdf, l.expiryDate() != null ? l.expiryDate().format(DATE_FMT) : "—"));
                    lTable.addCell(bodyCell(pdf, statusLabel(l.status())));
                });
        doc.add(lTable.setMarginBottom(16));

        doc.add(sectionTitle(pdf, "Contratos"));
        Table cTable = new Table(new float[]{3, 2, 2, 2});
        cTable.setWidth(UnitValue.createPercentValue(100));
        for (String h : List.of("Nome", "Fornecedor", "Vencimento", "Status"))
            cTable.addHeaderCell(headerCell(pdf, h));
        contracts.stream()
                .sorted(Comparator.comparing(ContractResponse::daysUntilExpiry))
                .forEach(c -> {
                    cTable.addCell(bodyCell(pdf, c.name()));
                    cTable.addCell(bodyCell(pdf, c.vendor() != null ? c.vendor() : "—"));
                    cTable.addCell(bodyCell(pdf, c.endDate() != null ? c.endDate().format(DATE_FMT) : "—"));
                    cTable.addCell(bodyCell(pdf, statusLabel(c.status())));
                });
        doc.add(cTable.setMarginBottom(16));

        return finish(pdf);
    }

    // ── Relatório de Inventário ───────────────────────────────────────────────

    public byte[] inventoryReport() {
        List<InventoryItem> items = inventoryRepo.findAll();
        Map<String, Long> byStatus = new LinkedHashMap<>();
        items.forEach(i -> byStatus.merge(i.getStatus().name(), 1L, Long::sum));
        BigDecimal totalValue = items.stream()
                .map(i -> i.getValue() != null ? i.getValue() : BigDecimal.ZERO)
                .reduce(BigDecimal.ZERO, BigDecimal::add);

        ReportPdf pdf = newPdf("Relatório de Inventário");
        Document doc = pdf.doc;

        doc.add(kpiLine(pdf, items.size() + " ativo(s) cadastrado(s) | valor total estimado R$ " + fmtMoney(totalValue)));

        doc.add(sectionTitle(pdf, "Por status"));
        doc.add(twoColTable(pdf, "Status", "Qtde", byStatus));

        doc.add(sectionTitle(pdf, "Ativos"));
        Table table = new Table(new float[]{3, 2, 2, 2, 2});
        table.setWidth(UnitValue.createPercentValue(100));
        for (String h : List.of("Nome", "Tipo", "Local", "Responsável", "Status"))
            table.addHeaderCell(headerCell(pdf, h));
        items.forEach(i -> {
            table.addCell(bodyCell(pdf, i.getName()));
            table.addCell(bodyCell(pdf, i.getType().name()));
            table.addCell(bodyCell(pdf, i.getLocation() != null ? i.getLocation() : "—"));
            table.addCell(bodyCell(pdf, i.getResponsible() != null ? i.getResponsible().getName() : "—"));
            table.addCell(bodyCell(pdf, i.getStatus().name()));
        });
        doc.add(table.setMarginBottom(16));

        return finish(pdf);
    }

    // ── Relatório de Segurança/Auditoria ─────────────────────────────────────

    public byte[] securityReport(int days) {
        LocalDateTime since = LocalDateTime.now().minusDays(Math.max(1, days));
        List<AuditEvent> events = auditEventRepo.findRecent(since, null);

        Map<String, Long> byModule = new LinkedHashMap<>();
        Map<String, Long> byAction = new LinkedHashMap<>();
        Map<String, Long> byActor = new LinkedHashMap<>();
        long mismatches = 0;
        for (AuditEvent e : events) {
            byModule.merge(e.getModule().name(), 1L, Long::sum);
            byAction.merge(e.getAction(), 1L, Long::sum);
            byActor.merge(e.getActorName() != null ? e.getActorName() : "Desconhecido", 1L, Long::sum);
            if ("HOST_KEY_MISMATCH".equals(e.getAction())) mismatches++;
        }

        ReportPdf pdf = newPdf("Relatório de Segurança — últimos " + days + " dia(s)");
        Document doc = pdf.doc;

        doc.add(kpiLine(pdf, events.size() + " evento(s) de auditoria no período"
                + (mismatches > 0 ? " | " + mismatches + " alerta(s) de chave SSH alterada" : "")));

        doc.add(sectionTitle(pdf, "Por módulo"));
        doc.add(twoColTable(pdf, "Módulo", "Eventos", byModule));

        doc.add(sectionTitle(pdf, "Por ação"));
        doc.add(twoColTable(pdf, "Ação", "Eventos", byAction));

        doc.add(sectionTitle(pdf, "Por usuário"));
        doc.add(twoColTable(pdf, "Usuário", "Eventos", topEntries(byActor, 10)));

        doc.add(sectionTitle(pdf, "Eventos recentes"));
        Table table = new Table(new float[]{2, 2, 2, 3, 3});
        table.setWidth(UnitValue.createPercentValue(100));
        for (String h : List.of("Data", "Módulo", "Ação", "Usuário", "Alvo"))
            table.addHeaderCell(headerCell(pdf, h));
        events.stream()
                .sorted(Comparator.comparing(AuditEvent::getCreatedAt).reversed())
                .limit(50)
                .forEach(e -> {
                    table.addCell(bodyCell(pdf, e.getCreatedAt().format(DATETIME_FMT)));
                    table.addCell(bodyCell(pdf, e.getModule().name()));
                    table.addCell(bodyCell(pdf, e.getAction()));
                    table.addCell(bodyCell(pdf, e.getActorName()));
                    table.addCell(bodyCell(pdf, e.getTargetLabel()));
                });
        doc.add(table.setMarginBottom(16));

        return finish(pdf);
    }

    // ── Relatório de Equipe (Produtividade) ──────────────────────────────────

    private static class TechStats {
        String name;
        long conversationsClaimed;
        long conversationsClosed;
        final List<Long> resolutionMinutes = new ArrayList<>();
        long tasksTotal;
        long tasksDone;
        long tasksOverdue;
    }

    public byte[] teamReport(int days) {
        LocalDateTime since = LocalDateTime.now().minusDays(Math.max(1, days));
        Map<UUID, TechStats> stats = new LinkedHashMap<>();

        conversationRepo.findAllSince(since).forEach(c -> {
            User tech = c.getClaimedBy();
            if (tech == null) return;
            TechStats s = stats.computeIfAbsent(tech.getId(), id -> newStats(tech.getName()));
            s.conversationsClaimed++;
            if (c.getState() == ConversationState.CLOSED) {
                s.conversationsClosed++;
                if (c.getClaimedAt() != null && c.getClosedAt() != null) {
                    s.resolutionMinutes.add(ChronoUnit.MINUTES.between(c.getClaimedAt(), c.getClosedAt()));
                }
            }
        });

        LocalDate today = LocalDate.now();
        planningTaskRepo.findAllWithAssignee().forEach(t -> {
            List<User> people = new ArrayList<>();
            if (t.getAssignee() != null) people.add(t.getAssignee());
            t.getMembers().forEach(m -> people.add(m.getUser()));
            boolean done = DONE_COLUMN.equals(t.getColumnName());
            boolean overdue = t.getDueDate() != null && t.getDueDate().isBefore(today) && !done;
            people.forEach(p -> {
                TechStats s = stats.computeIfAbsent(p.getId(), id -> newStats(p.getName()));
                s.tasksTotal++;
                if (done) s.tasksDone++;
                if (overdue) s.tasksOverdue++;
            });
        });

        ReportPdf pdf = newPdf("Relatório de Equipe — últimos " + days + " dia(s)");
        Document doc = pdf.doc;

        doc.add(kpiLine(pdf, stats.size() + " pessoa(s) com atividade registrada no período"));

        doc.add(sectionTitle(pdf, "Produtividade por pessoa"));
        Table table = new Table(new float[]{3, 1.5f, 1.5f, 2, 1.5f, 1.5f, 1.5f});
        table.setWidth(UnitValue.createPercentValue(100));
        for (String h : List.of("Pessoa", "Chamados", "Fechados", "Tempo médio", "Tarefas", "Concluídas", "Atrasadas"))
            table.addHeaderCell(headerCell(pdf, h));
        stats.values().stream()
                .sorted(Comparator.comparingLong((TechStats s) -> s.conversationsClaimed).reversed())
                .forEach(s -> {
                    Double avg = s.resolutionMinutes.isEmpty() ? null
                            : s.resolutionMinutes.stream().mapToLong(Long::longValue).average().orElse(0);
                    table.addCell(bodyCell(pdf, s.name));
                    table.addCell(bodyCell(pdf, String.valueOf(s.conversationsClaimed)));
                    table.addCell(bodyCell(pdf, String.valueOf(s.conversationsClosed)));
                    table.addCell(bodyCell(pdf, avg != null ? formatMinutes(avg.longValue()) : "—"));
                    table.addCell(bodyCell(pdf, String.valueOf(s.tasksTotal)));
                    table.addCell(bodyCell(pdf, String.valueOf(s.tasksDone)));
                    table.addCell(bodyCell(pdf, String.valueOf(s.tasksOverdue)));
                });
        doc.add(table.setMarginBottom(16));

        return finish(pdf);
    }

    private TechStats newStats(String name) {
        TechStats s = new TechStats();
        s.name = name;
        return s;
    }

    // ── Relatório de Monitoramento e Disponibilidade ─────────────────────────

    public byte[] monitoringReport() {
        List<ZabbixProblem> problems = zabbixService.getProblems();
        Map<String, Long> bySeverity = new LinkedHashMap<>();
        problems.forEach(p -> bySeverity.merge(p.severityLabel(), 1L, Long::sum));

        List<MonitoredUrl> urls = monitoredUrlRepo.findAllByOrderByNameAsc();
        long urlsDown = urls.stream()
                .filter(u -> Boolean.TRUE.equals(u.getEnabled()) && u.getLastStatus() != null && u.getLastStatus() >= 400)
                .count();
        List<BigDecimal> uptimes = urls.stream().map(MonitoredUrl::getUptimePct)
                .filter(java.util.Objects::nonNull).toList();
        BigDecimal avgUptime = uptimes.isEmpty() ? null
                : sum2(uptimes.stream()).divide(BigDecimal.valueOf(uptimes.size()), 2, java.math.RoundingMode.HALF_UP);

        ReportPdf pdf = newPdf("Relatório de Monitoramento e Disponibilidade");
        Document doc = pdf.doc;

        doc.add(kpiLine(pdf, problems.size() + " problema(s) ativo(s) no Zabbix"
                + " | " + urls.size() + " URL(s) monitorada(s), " + urlsDown + " fora do ar"
                + (avgUptime != null ? " | uptime médio " + avgUptime + "%" : "")));

        doc.add(sectionTitle(pdf, "Problemas ativos por severidade"));
        doc.add(twoColTable(pdf, "Severidade", "Qtde", bySeverity));

        doc.add(sectionTitle(pdf, "Problemas ativos"));
        Table pTable = new Table(new float[]{3, 3, 2});
        pTable.setWidth(UnitValue.createPercentValue(100));
        for (String h : List.of("Host", "Problema", "Severidade"))
            pTable.addHeaderCell(headerCell(pdf, h));
        problems.stream()
                .sorted(Comparator.comparingInt(ZabbixProblem::severity).reversed())
                .forEach(p -> {
                    pTable.addCell(bodyCell(pdf, p.hostName()));
                    pTable.addCell(bodyCell(pdf, p.name()));
                    pTable.addCell(bodyCell(pdf, p.severityLabel()));
                });
        doc.add(pTable.setMarginBottom(16));

        doc.add(sectionTitle(pdf, "URLs monitoradas"));
        Table uTable = new Table(new float[]{3, 2, 2, 2});
        uTable.setWidth(UnitValue.createPercentValue(100));
        for (String h : List.of("Nome", "Status", "Último check", "Uptime"))
            uTable.addHeaderCell(headerCell(pdf, h));
        urls.forEach(u -> {
            uTable.addCell(bodyCell(pdf, u.getName()));
            uTable.addCell(bodyCell(pdf, u.getLastStatus() != null ? String.valueOf(u.getLastStatus()) : "—"));
            uTable.addCell(bodyCell(pdf, u.getLastCheck() != null ? u.getLastCheck().format(DATETIME_FMT) : "—"));
            uTable.addCell(bodyCell(pdf, u.getUptimePct() != null ? u.getUptimePct() + "%" : "—"));
        });
        doc.add(uTable.setMarginBottom(16));

        return finish(pdf);
    }

    // ── PDF helpers ───────────────────────────────────────────────────────────

    private record ReportPdf(Document doc, ByteArrayOutputStream out, PdfFont fontBold, PdfFont fontRegular, DeviceRgb blue) {}

    private ReportPdf newPdf(String title) {
        try {
            ByteArrayOutputStream out = new ByteArrayOutputStream();
            PdfWriter writer = new PdfWriter(out);
            PdfDocument pdfDoc = new PdfDocument(writer);
            Document doc = new Document(pdfDoc, PageSize.A4);
            doc.setMargins(36, 36, 36, 36);

            PdfFont fontBold = PdfFontFactory.createFont(StandardFonts.HELVETICA_BOLD);
            PdfFont fontRegular = PdfFontFactory.createFont(StandardFonts.HELVETICA);
            DeviceRgb blue = new DeviceRgb(30, 64, 175);

            doc.add(new Paragraph(companyName).setFont(fontBold).setFontSize(11).setFontColor(ColorConstants.GRAY));
            doc.add(new Paragraph(title).setFont(fontBold).setFontSize(16).setFontColor(blue));
            doc.add(new Paragraph("Gerado em: " + LocalDate.now().format(DATE_FMT))
                    .setFont(fontRegular).setFontSize(10).setFontColor(ColorConstants.GRAY).setMarginBottom(18));

            return new ReportPdf(doc, out, fontBold, fontRegular, blue);
        } catch (Exception e) {
            throw new IllegalStateException("Falha ao gerar relatório PDF: " + e.getMessage(), e);
        }
    }

    private byte[] finish(ReportPdf pdf) {
        pdf.doc.close();
        return pdf.out.toByteArray();
    }

    private Paragraph sectionTitle(ReportPdf pdf, String text) {
        return new Paragraph(text).setFont(pdf.fontBold).setFontSize(13).setMarginTop(6).setMarginBottom(8);
    }

    private Paragraph kpiLine(ReportPdf pdf, String text) {
        return new Paragraph(text).setFont(pdf.fontRegular).setFontSize(10.5f).setMarginBottom(10);
    }

    private Cell headerCell(ReportPdf pdf, String text) {
        return new Cell().add(new Paragraph(text).setFont(pdf.fontBold).setFontSize(9));
    }

    private Cell bodyCell(ReportPdf pdf, String text) {
        return new Cell().add(new Paragraph(text != null ? text : "—").setFont(pdf.fontRegular).setFontSize(9));
    }

    private Table twoColTable(ReportPdf pdf, String col1, String col2, Map<String, Long> data) {
        Table table = new Table(new float[]{3, 1});
        table.setWidth(UnitValue.createPercentValue(100));
        table.addHeaderCell(headerCell(pdf, col1));
        table.addHeaderCell(headerCell(pdf, col2));
        if (data.isEmpty()) {
            table.addCell(bodyCell(pdf, "—"));
            table.addCell(bodyCell(pdf, "0"));
        } else {
            data.forEach((k, v) -> {
                table.addCell(bodyCell(pdf, k));
                table.addCell(bodyCell(pdf, String.valueOf(v)));
            });
        }
        table.setMarginBottom(16);
        return table;
    }

    // ── Misc helpers ──────────────────────────────────────────────────────────

    private LocalDateTime parseGlpiDate(String raw) {
        if (raw == null || raw.isBlank()) return null;
        try {
            return LocalDateTime.parse(raw, GLPI_DATETIME_FMT);
        } catch (DateTimeParseException e) {
            return null;
        }
    }

    private String formatMinutes(long minutes) {
        if (minutes < 60) return minutes + "min";
        long hours = minutes / 60;
        if (hours < 24) return hours + "h " + (minutes % 60) + "min";
        long days = hours / 24;
        return days + "d " + (hours % 24) + "h";
    }

    private String statusLabel(String status) {
        return switch (status) {
            case "EXPIRED" -> "Vencido";
            case "EXPIRING_SOON" -> "Vence em até 30 dias";
            case "EXPIRING" -> "Vence em até 90 dias";
            default -> "OK";
        };
    }

    private BigDecimal sum(java.util.stream.Stream<Bill> bills) {
        return bills.map(Bill::getAmount).filter(java.util.Objects::nonNull).reduce(BigDecimal.ZERO, BigDecimal::add);
    }

    private BigDecimal sum2(java.util.stream.Stream<BigDecimal> values) {
        return values.filter(java.util.Objects::nonNull).reduce(BigDecimal.ZERO, BigDecimal::add);
    }

    private String fmtMoney(BigDecimal value) {
        return value.setScale(2, java.math.RoundingMode.HALF_UP).toPlainString();
    }

    private Map<String, Long> topEntries(Map<String, Long> data, int limit) {
        return data.entrySet().stream()
                .sorted(Map.Entry.<String, Long>comparingByValue().reversed())
                .limit(limit)
                .collect(LinkedHashMap::new, (m, e) -> m.put(e.getKey(), e.getValue()), Map::putAll);
    }
}
