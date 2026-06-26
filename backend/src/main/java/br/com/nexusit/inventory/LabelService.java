package br.com.nexusit.inventory;

import com.google.zxing.BarcodeFormat;
import com.google.zxing.EncodeHintType;
import com.google.zxing.client.j2se.MatrixToImageWriter;
import com.google.zxing.common.BitMatrix;
import com.google.zxing.qrcode.QRCodeWriter;
import com.itextpdf.io.image.ImageDataFactory;
import com.itextpdf.kernel.colors.ColorConstants;
import com.itextpdf.kernel.colors.DeviceRgb;
import com.itextpdf.kernel.font.PdfFont;
import com.itextpdf.kernel.font.PdfFontFactory;
import com.itextpdf.kernel.geom.PageSize;
import com.itextpdf.kernel.pdf.PdfDocument;
import com.itextpdf.kernel.pdf.PdfWriter;
import com.itextpdf.layout.Document;
import com.itextpdf.layout.element.Cell;
import com.itextpdf.layout.element.Image;
import com.itextpdf.layout.element.Paragraph;
import com.itextpdf.layout.element.Table;
import com.itextpdf.layout.properties.HorizontalAlignment;
import com.itextpdf.layout.properties.TextAlignment;
import com.itextpdf.layout.properties.UnitValue;
import com.itextpdf.layout.properties.VerticalAlignment;
import lombok.RequiredArgsConstructor;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Service;

import java.io.ByteArrayOutputStream;
import java.util.Map;
import java.util.UUID;

@Service
@RequiredArgsConstructor
public class LabelService {

    private final InventoryRepository repository;

    @Value("${app.base-url:http://nexus.local}")
    private String baseUrl;

    @Value("${app.company-name:Armazém Galdino}")
    private String companyName;

    @Value("${app.support-phone:}")
    private String supportPhone;

    public byte[] generateLabel(UUID itemId) {
        InventoryItem item = repository.findById(itemId)
                .orElseThrow(() -> new jakarta.persistence.EntityNotFoundException("Item não encontrado: " + itemId));

        try {
            return buildPdf(item);
        } catch (Exception e) {
            throw new RuntimeException("Erro ao gerar etiqueta PDF", e);
        }
    }

    private byte[] buildPdf(InventoryItem item) throws Exception {
        ByteArrayOutputStream baos = new ByteArrayOutputStream();

        // Label size: 90mm x 50mm (standard thermal label)
        float widthPt  = mmToPt(90);
        float heightPt = mmToPt(50);
        PageSize pageSize = new PageSize(widthPt, heightPt);

        PdfWriter writer = new PdfWriter(baos);
        PdfDocument pdf  = new PdfDocument(writer);
        Document doc     = new Document(pdf, pageSize);
        doc.setMargins(mmToPt(3), mmToPt(3), mmToPt(3), mmToPt(3));

        PdfFont fontBold    = PdfFontFactory.createFont(com.itextpdf.io.font.constants.StandardFonts.HELVETICA_BOLD);
        PdfFont fontRegular = PdfFontFactory.createFont(com.itextpdf.io.font.constants.StandardFonts.HELVETICA);

        DeviceRgb blue      = new DeviceRgb(30, 64, 175);
        DeviceRgb lightGray = new DeviceRgb(248, 250, 252);
        DeviceRgb darkText  = new DeviceRgb(15, 23, 42);
        DeviceRgb mutedText = new DeviceRgb(100, 116, 139);

        // QR Code
        String qrContent = baseUrl + "/inventory/" + item.getId();
        byte[] qrBytes = generateQrCode(qrContent, 200);
        Image qrImage = new Image(ImageDataFactory.create(qrBytes));
        qrImage.setWidth(mmToPt(22));
        qrImage.setHeight(mmToPt(22));

        // Layout: two-column table (QR | info)
        Table layout = new Table(new float[]{mmToPt(25), mmToPt(59)});
        layout.setWidth(UnitValue.createPointValue(widthPt - mmToPt(6)));

        // --- Header row spanning both columns ---
        Cell headerCell = new Cell(1, 2)
                .setBackgroundColor(blue)
                .setBorder(com.itextpdf.layout.borders.Border.NO_BORDER)
                .setPadding(mmToPt(1.5f));
        headerCell.add(new Paragraph(companyName)
                .setFont(fontBold)
                .setFontSize(8)
                .setFontColor(ColorConstants.WHITE)
                .setTextAlignment(TextAlignment.CENTER)
                .setMargin(0));
        layout.addCell(headerCell);

        // --- QR Code cell ---
        Cell qrCell = new Cell()
                .setBorder(com.itextpdf.layout.borders.Border.NO_BORDER)
                .setBackgroundColor(lightGray)
                .setPadding(mmToPt(1.5f))
                .setVerticalAlignment(VerticalAlignment.MIDDLE)
                .setHorizontalAlignment(HorizontalAlignment.CENTER);
        qrCell.add(qrImage);
        layout.addCell(qrCell);

        // --- Info cell ---
        Cell infoCell = new Cell()
                .setBorder(com.itextpdf.layout.borders.Border.NO_BORDER)
                .setBackgroundColor(lightGray)
                .setPaddingLeft(mmToPt(2))
                .setPaddingTop(mmToPt(1.5f))
                .setPaddingBottom(mmToPt(1.5f))
                .setVerticalAlignment(VerticalAlignment.MIDDLE);

        // Tombamento — destaque principal
        if (item.getTombamento() != null) {
            infoCell.add(new Paragraph(item.getTombamento())
                    .setFont(fontBold)
                    .setFontSize(11)
                    .setFontColor(blue)
                    .setMarginBottom(1));
        }

        // Nome do equipamento
        String displayName = buildDisplayName(item);
        infoCell.add(new Paragraph(displayName)
                .setFont(fontBold)
                .setFontSize(7)
                .setFontColor(darkText)
                .setMarginBottom(1));

        // Localização
        if (item.getLocation() != null && !item.getLocation().isBlank()) {
            infoCell.add(new Paragraph("📍 " + item.getLocation())
                    .setFont(fontRegular)
                    .setFontSize(6.5f)
                    .setFontColor(mutedText)
                    .setMarginBottom(1));
        }

        // Nº de série
        if (item.getSerialNumber() != null && !item.getSerialNumber().isBlank()) {
            infoCell.add(new Paragraph("SN: " + item.getSerialNumber())
                    .setFont(fontRegular)
                    .setFontSize(6)
                    .setFontColor(mutedText)
                    .setMarginBottom(1));
        }

        layout.addCell(infoCell);

        // --- Footer row ---
        String footerText = supportPhone != null && !supportPhone.isBlank()
                ? "TI: " + supportPhone + "  |  " + baseUrl
                : baseUrl;
        Cell footerCell = new Cell(1, 2)
                .setBackgroundColor(blue)
                .setBorder(com.itextpdf.layout.borders.Border.NO_BORDER)
                .setPadding(mmToPt(1));
        footerCell.add(new Paragraph(footerText)
                .setFont(fontRegular)
                .setFontSize(5.5f)
                .setFontColor(ColorConstants.WHITE)
                .setTextAlignment(TextAlignment.CENTER)
                .setMargin(0));
        layout.addCell(footerCell);

        doc.add(layout);
        doc.close();
        return baos.toByteArray();
    }

    private String buildDisplayName(InventoryItem item) {
        StringBuilder sb = new StringBuilder();
        if (item.getBrand() != null) sb.append(item.getBrand());
        if (item.getModel() != null) {
            if (!sb.isEmpty()) sb.append(" ");
            sb.append(item.getModel());
        }
        if (sb.isEmpty()) sb.append(item.getName());
        String result = sb.toString();
        return result.length() > 30 ? result.substring(0, 28) + "…" : result;
    }

    private byte[] generateQrCode(String content, int size) throws Exception {
        QRCodeWriter writer = new QRCodeWriter();
        Map<EncodeHintType, Object> hints = Map.of(
                EncodeHintType.MARGIN, 1,
                EncodeHintType.ERROR_CORRECTION, com.google.zxing.qrcode.decoder.ErrorCorrectionLevel.M
        );
        BitMatrix matrix = writer.encode(content, BarcodeFormat.QR_CODE, size, size, hints);
        ByteArrayOutputStream baos = new ByteArrayOutputStream();
        MatrixToImageWriter.writeToStream(matrix, "PNG", baos);
        return baos.toByteArray();
    }

    private float mmToPt(float mm) {
        return mm * 2.8346f;
    }
}
