package br.com.nexusit.termos;

import com.itextpdf.io.image.ImageDataFactory;
import com.itextpdf.kernel.colors.ColorConstants;
import com.itextpdf.kernel.geom.PageSize;
import com.itextpdf.kernel.pdf.PdfDocument;
import com.itextpdf.kernel.pdf.PdfWriter;
import com.itextpdf.layout.Document;
import com.itextpdf.layout.borders.SolidBorder;
import com.itextpdf.layout.element.*;
import com.itextpdf.layout.properties.*;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;

import java.io.ByteArrayOutputStream;
import java.math.BigDecimal;
import java.net.URI;
import java.time.format.DateTimeFormatter;
import java.util.Base64;

@Service
@RequiredArgsConstructor
public class TermoPdfService {
    private final TermoService termoService;

    public byte[] generatePdf(java.util.UUID id) {
        var termo = termoService.get(id);
        var template = termo.getTemplate();
        try (ByteArrayOutputStream out = new ByteArrayOutputStream()) {
            PdfWriter writer = new PdfWriter(out);
            PdfDocument pdf = new PdfDocument(writer);
            Document doc = new Document(pdf, PageSize.A4);
            doc.setMargins(36, 36, 36, 36);

            addLogo(doc, template);
            doc.add(new Paragraph("TERMO DE RESPONSABILIDADE DE EQUIPAMENTO")
                    .setBold().setFontSize(16).setTextAlignment(TextAlignment.CENTER));
            doc.add(new Paragraph(termo.getNumeroTermo()).setFontSize(11).setTextAlignment(TextAlignment.CENTER).setMarginBottom(12));

            doc.add(section("Dados do responsável"));
            doc.add(table(new String[][]{
                    {"Responsável", termo.getResponsavelNome()}, {"CPF", termo.getCpf()}, {"Cargo", termo.getCargo()},
                    {"Setor", termo.getSetor()}, {"Data de entrega", fmt(termo.getDataEntrega())}
            }));

            doc.add(section("Dados do equipamento"));
            doc.add(table(new String[][]{
                    {"Tipo", termo.getTipoEquipamento()}, {"Marca", termo.getMarca()}, {"Modelo", termo.getModelo()},
                    {"Número de série", termo.getNumeroSerie()}, {"Tombamento", termo.getTombamento()},
                    {"Condição inicial", termo.getCondicaoInicial()}, {"Observações", termo.getObservacoes()}
            }));

            doc.add(section("Acessórios entregues"));
            var accessories = termoService.findById(id).acessorios();
            if (accessories.isEmpty()) doc.add(new Paragraph("Nenhum acessório informado."));
            else {
                List list = new List().setSymbolIndent(12).setListSymbol("• ");
                accessories.forEach(a -> list.add(new ListItem(a)));
                doc.add(list);
            }

            doc.add(section("Cláusulas do termo"));
            String clauses = template != null ? template.getClausulas() : "";
            for (String block : clauses.split("\\n\\n")) if (!block.isBlank()) doc.add(new Paragraph(block.trim()).setFontSize(10).setTextAlignment(TextAlignment.JUSTIFIED));

            doc.add(section("Histórico de ocorrências"));
            if (termo.getOcorrencias().isEmpty()) doc.add(new Paragraph("Sem ocorrências registradas."));
            else {
                Table ot = new Table(UnitValue.createPercentArray(new float[]{2,2,5,2,2})).useAllAvailableWidth();
                for (String h : new String[]{"Data", "Tipo", "Descrição", "Responsável", "Custo"}) ot.addHeaderCell(header(h));
                termo.getOcorrencias().forEach(o -> {
                    ot.addCell(cell(fmt(o.getData()))); ot.addCell(cell(String.valueOf(o.getTipo()))); ot.addCell(cell(o.getDescricao()));
                    ot.addCell(cell(o.getResponsabilidade() == null ? "" : String.valueOf(o.getResponsabilidade())));
                    ot.addCell(cell(o.getCusto() == null ? "" : "R$ " + o.getCusto()));
                });
                doc.add(ot);
            }

            doc.add(section("Assinatura digital"));
            if (termo.getAssinaturaDigital() != null && !termo.getAssinaturaDigital().isBlank()) {
                addSignature(doc, termo.getAssinaturaDigital());
                doc.add(new Paragraph("Assinado em: " + fmt(termo.getDataHoraAssinatura()) + " | IP: " + nz(termo.getIpAssinante())).setFontSize(9));
                doc.add(new Paragraph("Hash SHA-256 do documento: " + nz(termo.getHashDocumento())).setFontSize(8));
            } else {
                doc.add(new Paragraph("Termo ainda não assinado.").setItalic());
            }
            doc.close();
            return out.toByteArray();
        } catch (Exception e) {
            throw new IllegalStateException("Falha ao gerar PDF do termo", e);
        }
    }

    private void addLogo(Document doc, TermoTemplate template) {
        if (template == null || template.getLogoUrl() == null || template.getLogoUrl().isBlank()) return;
        try {
            byte[] bytes = template.getLogoUrl().startsWith("data:")
                    ? Base64.getDecoder().decode(template.getLogoUrl().substring(template.getLogoUrl().indexOf(',') + 1))
                    : URI.create(template.getLogoUrl()).toURL().openStream().readAllBytes();
            Image img = new Image(ImageDataFactory.create(bytes)).setMaxHeight(70).setAutoScale(true);
            String pos = template.getLogoPosition() == null ? "TOPO_CENTRO" : template.getLogoPosition();
            img.setHorizontalAlignment(pos.contains("DIREITA") ? HorizontalAlignment.RIGHT : pos.contains("ESQUERDA") ? HorizontalAlignment.LEFT : HorizontalAlignment.CENTER);
            doc.add(img);
        } catch (Exception ignored) {}
    }

    private void addSignature(Document doc, String dataUrl) {
        try {
            String b64 = dataUrl.contains(",") ? dataUrl.substring(dataUrl.indexOf(',') + 1) : dataUrl;
            Image img = new Image(ImageDataFactory.create(Base64.getDecoder().decode(b64))).setMaxHeight(90).setAutoScale(true);
            doc.add(img);
        } catch (Exception e) { doc.add(new Paragraph("Assinatura digital registrada, mas imagem não pôde ser renderizada.")); }
    }
    private Paragraph section(String s) { return new Paragraph(s).setBold().setFontSize(12).setMarginTop(12).setBorderBottom(new SolidBorder(ColorConstants.LIGHT_GRAY, 1)); }
    private Table table(String[][] rows) { Table t = new Table(UnitValue.createPercentArray(new float[]{2,5})).useAllAvailableWidth(); for (String[] r : rows) { t.addCell(header(r[0])); t.addCell(cell(r[1])); } return t; }
    private Cell header(String s) { return new Cell().add(new Paragraph(s).setBold().setFontSize(9)).setBackgroundColor(ColorConstants.LIGHT_GRAY); }
    private Cell cell(String s) { return new Cell().add(new Paragraph(nz(s)).setFontSize(9)); }
    private String nz(Object o) { return o == null ? "" : String.valueOf(o); }
    private String fmt(java.time.LocalDate d) { return d == null ? "" : d.format(DateTimeFormatter.ofPattern("dd/MM/yyyy")); }
    private String fmt(java.time.LocalDateTime d) { return d == null ? "" : d.format(DateTimeFormatter.ofPattern("dd/MM/yyyy HH:mm")); }
}
