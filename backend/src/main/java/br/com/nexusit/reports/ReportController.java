package br.com.nexusit.reports;

import br.com.nexusit.inventory.InventoryRepository;
import br.com.nexusit.licenses.LicenseRepository;
import com.itextpdf.io.font.constants.StandardFonts;
import com.itextpdf.kernel.colors.ColorConstants;
import com.itextpdf.kernel.colors.DeviceRgb;
import com.itextpdf.kernel.font.PdfFontFactory;
import com.itextpdf.kernel.pdf.PdfDocument;
import com.itextpdf.kernel.pdf.PdfWriter;
import com.itextpdf.layout.Document;
import com.itextpdf.layout.element.Cell;
import com.itextpdf.layout.element.Paragraph;
import com.itextpdf.layout.element.Table;
import com.itextpdf.layout.properties.TextAlignment;
import com.itextpdf.layout.properties.UnitValue;
import lombok.RequiredArgsConstructor;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.http.HttpHeaders;
import org.springframework.http.MediaType;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

import java.io.ByteArrayOutputStream;
import java.time.LocalDate;
import java.time.format.DateTimeFormatter;
import java.time.temporal.ChronoUnit;
import java.util.List;

@RestController
@RequestMapping("/api/reports")
@RequiredArgsConstructor
@PreAuthorize("hasRole('ADMIN')")
public class ReportController {

    private final InventoryRepository inventoryRepo;
    private final LicenseRepository licenseRepo;

    @Value("${app.company-name:Armazém Galdino}")
    private String companyName;

    @GetMapping("/inventory/csv")
    public ResponseEntity<byte[]> inventoryCsv() {
        StringBuilder sb = new StringBuilder();
        sb.append("Tombamento,Nome,Tipo,Marca,Modelo,Nº Série,Localização,Responsável,Status,Data Compra,Garantia Até,Valor\n");
        inventoryRepo.findAll().forEach(i -> sb
                .append(csv(i.getTombamento())).append(',')
                .append(csv(i.getName())).append(',')
                .append(csv(i.getType().name())).append(',')
                .append(csv(i.getBrand())).append(',')
                .append(csv(i.getModel())).append(',')
                .append(csv(i.getSerialNumber())).append(',')
                .append(csv(i.getLocation())).append(',')
                .append(csv(i.getResponsible() != null ? i.getResponsible().getName() : "")).append(',')
                .append(csv(i.getStatus().name())).append(',')
                .append(csv(i.getPurchaseDate() != null ? i.getPurchaseDate().toString() : "")).append(',')
                .append(csv(i.getWarrantyUntil() != null ? i.getWarrantyUntil().toString() : "")).append(',')
                .append(i.getValue() != null ? i.getValue().toPlainString() : "")
                .append('\n'));

        byte[] data = sb.toString().getBytes(java.nio.charset.StandardCharsets.UTF_8);
        String filename = "inventario-" + LocalDate.now() + ".csv";
        return ResponseEntity.ok()
                .contentType(MediaType.parseMediaType("text/csv;charset=UTF-8"))
                .header(HttpHeaders.CONTENT_DISPOSITION, "attachment; filename=\"" + filename + "\"")
                .body(data);
    }

    @GetMapping("/weekly")
    public ResponseEntity<byte[]> weeklyReport() throws Exception {
        ByteArrayOutputStream baos = new ByteArrayOutputStream();
        PdfWriter writer = new PdfWriter(baos);
        PdfDocument pdf = new PdfDocument(writer);
        Document doc = new Document(pdf);

        var fontBold    = PdfFontFactory.createFont(StandardFonts.HELVETICA_BOLD);
        var fontRegular = PdfFontFactory.createFont(StandardFonts.HELVETICA);
        var blue        = new DeviceRgb(30, 64, 175);
        var fmt         = DateTimeFormatter.ofPattern("dd/MM/yyyy");

        // Header
        doc.add(new Paragraph(companyName + " — Relatório Semanal de TI")
                .setFont(fontBold).setFontSize(16).setFontColor(blue));
        doc.add(new Paragraph("Gerado em: " + LocalDate.now().format(fmt))
                .setFont(fontRegular).setFontSize(10).setFontColor(ColorConstants.GRAY).setMarginBottom(20));

        // Inventory section
        doc.add(new Paragraph("Inventário de Hardware").setFont(fontBold).setFontSize(13).setMarginBottom(8));
        var items = inventoryRepo.findAll();
        long active = items.stream().filter(i -> i.getStatus().name().equals("ACTIVE")).count();
        long maintenance = items.stream().filter(i -> i.getStatus().name().equals("MAINTENANCE")).count();
        doc.add(new Paragraph(String.format("Total: %d | Ativos: %d | Em manutenção: %d", items.size(), active, maintenance))
                .setFont(fontRegular).setFontSize(10).setMarginBottom(16));

        // Licenses expiring
        List<br.com.nexusit.licenses.License> expiring = licenseRepo.findExpiringBetween(
                LocalDate.now(), LocalDate.now().plusDays(90));
        doc.add(new Paragraph("Licenças a Vencer (próximos 90 dias)").setFont(fontBold).setFontSize(13).setMarginBottom(8));
        if (expiring.isEmpty()) {
            doc.add(new Paragraph("Nenhuma licença a vencer.").setFont(fontRegular).setFontSize(10).setMarginBottom(16));
        } else {
            Table table = new Table(new float[]{3, 2, 2, 2});
            table.setWidth(UnitValue.createPercentValue(100));
            for (String h : List.of("Nome", "Fornecedor", "Vencimento", "Assentos")) {
                table.addHeaderCell(new Cell().add(new Paragraph(h).setFont(fontBold).setFontSize(9)));
            }
            expiring.forEach(l -> {
                long days = ChronoUnit.DAYS.between(LocalDate.now(), l.getExpiryDate());
                table.addCell(new Cell().add(new Paragraph(l.getName()).setFont(fontRegular).setFontSize(9)));
                table.addCell(new Cell().add(new Paragraph(l.getVendor() != null ? l.getVendor() : "—").setFont(fontRegular).setFontSize(9)));
                table.addCell(new Cell().add(new Paragraph(l.getExpiryDate().format(fmt) + " (" + days + "d)").setFont(fontRegular).setFontSize(9)));
                table.addCell(new Cell().add(new Paragraph(
                        l.getSeatsUsed() + "/" + (l.getSeatsTotal() != null ? l.getSeatsTotal() : "∞")
                ).setFont(fontRegular).setFontSize(9)));
            });
            doc.add(table.setMarginBottom(16));
        }

        doc.close();
        String filename = "relatorio-ti-" + LocalDate.now() + ".pdf";
        return ResponseEntity.ok()
                .contentType(MediaType.APPLICATION_PDF)
                .header(HttpHeaders.CONTENT_DISPOSITION, "inline; filename=\"" + filename + "\"")
                .body(baos.toByteArray());
    }

    private String csv(String v) {
        if (v == null) return "";
        if (v.contains(",") || v.contains("\"") || v.contains("\n"))
            return "\"" + v.replace("\"", "\"\"") + "\"";
        return v;
    }
}
