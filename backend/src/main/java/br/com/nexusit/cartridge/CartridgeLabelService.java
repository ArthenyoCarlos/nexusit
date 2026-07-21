package br.com.nexusit.cartridge;

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
import jakarta.persistence.EntityNotFoundException;
import lombok.RequiredArgsConstructor;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Service;

import java.io.ByteArrayOutputStream;
import java.util.Map;
import java.util.UUID;

/** Etiqueta térmica (mesmo formato 90x50mm do Inventário) para colar no cartucho físico. */
@Service
@RequiredArgsConstructor
public class CartridgeLabelService {

    private final CartridgeRepository repository;

    @Value("${app.base-url:http://nexus.local}")
    private String baseUrl;

    @Value("${app.company-name:Armazém Galdino}")
    private String companyName;

    public byte[] generateLabel(UUID cartridgeId) {
        Cartridge c = repository.findById(cartridgeId)
                .orElseThrow(() -> new EntityNotFoundException("Cartucho não encontrado: " + cartridgeId));
        try {
            return buildPdf(c);
        } catch (Exception e) {
            throw new RuntimeException("Erro ao gerar etiqueta PDF", e);
        }
    }

    private byte[] buildPdf(Cartridge c) throws Exception {
        ByteArrayOutputStream baos = new ByteArrayOutputStream();

        float widthPt = mmToPt(90);
        float heightPt = mmToPt(50);
        PdfWriter writer = new PdfWriter(baos);
        PdfDocument pdf = new PdfDocument(writer);
        Document doc = new Document(pdf, new PageSize(widthPt, heightPt));
        doc.setMargins(mmToPt(3), mmToPt(3), mmToPt(3), mmToPt(3));

        PdfFont fontBold = PdfFontFactory.createFont(com.itextpdf.io.font.constants.StandardFonts.HELVETICA_BOLD);
        PdfFont fontRegular = PdfFontFactory.createFont(com.itextpdf.io.font.constants.StandardFonts.HELVETICA);

        DeviceRgb blue = new DeviceRgb(30, 64, 175);
        DeviceRgb lightGray = new DeviceRgb(248, 250, 252);
        DeviceRgb darkText = new DeviceRgb(15, 23, 42);
        DeviceRgb mutedText = new DeviceRgb(100, 116, 139);

        String qrContent = baseUrl + "/cartridges/" + c.getId();
        byte[] qrBytes = generateQrCode(qrContent, 200);
        Image qrImage = new Image(ImageDataFactory.create(qrBytes));
        qrImage.setWidth(mmToPt(22));
        qrImage.setHeight(mmToPt(22));

        Table layout = new Table(new float[]{mmToPt(25), mmToPt(59)});
        layout.setWidth(UnitValue.createPointValue(widthPt - mmToPt(6)));

        Cell headerCell = new Cell(1, 2)
                .setBackgroundColor(blue)
                .setBorder(com.itextpdf.layout.borders.Border.NO_BORDER)
                .setPadding(mmToPt(1.5f));
        headerCell.add(new Paragraph(companyName)
                .setFont(fontBold).setFontSize(8).setFontColor(ColorConstants.WHITE)
                .setTextAlignment(TextAlignment.CENTER).setMargin(0));
        layout.addCell(headerCell);

        Cell qrCell = new Cell()
                .setBorder(com.itextpdf.layout.borders.Border.NO_BORDER)
                .setBackgroundColor(lightGray).setPadding(mmToPt(1.5f))
                .setVerticalAlignment(VerticalAlignment.MIDDLE).setHorizontalAlignment(HorizontalAlignment.CENTER);
        qrCell.add(qrImage);
        layout.addCell(qrCell);

        Cell infoCell = new Cell()
                .setBorder(com.itextpdf.layout.borders.Border.NO_BORDER)
                .setBackgroundColor(lightGray)
                .setPaddingLeft(mmToPt(2)).setPaddingTop(mmToPt(1.5f)).setPaddingBottom(mmToPt(1.5f))
                .setVerticalAlignment(VerticalAlignment.MIDDLE);

        infoCell.add(new Paragraph(c.getCode())
                .setFont(fontBold).setFontSize(11).setFontColor(blue).setMarginBottom(1));
        infoCell.add(new Paragraph(truncate(c.getModel(), 30))
                .setFont(fontBold).setFontSize(7).setFontColor(darkText).setMarginBottom(1));
        if (c.getPrinterModel() != null && !c.getPrinterModel().isBlank()) {
            infoCell.add(new Paragraph("🖨️ " + truncate(c.getPrinterModel(), 28))
                    .setFont(fontRegular).setFontSize(6.5f).setFontColor(mutedText).setMarginBottom(1));
        }
        layout.addCell(infoCell);

        Cell footerCell = new Cell(1, 2)
                .setBackgroundColor(blue)
                .setBorder(com.itextpdf.layout.borders.Border.NO_BORDER)
                .setPadding(mmToPt(1));
        footerCell.add(new Paragraph(baseUrl)
                .setFont(fontRegular).setFontSize(5.5f).setFontColor(ColorConstants.WHITE)
                .setTextAlignment(TextAlignment.CENTER).setMargin(0));
        layout.addCell(footerCell);

        doc.add(layout);
        doc.close();
        return baos.toByteArray();
    }

    private String truncate(String s, int max) {
        if (s == null) return "";
        return s.length() > max ? s.substring(0, max - 1) + "…" : s;
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
