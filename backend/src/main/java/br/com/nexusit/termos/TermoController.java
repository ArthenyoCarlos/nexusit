package br.com.nexusit.termos;

import jakarta.servlet.http.HttpServletRequest;
import lombok.RequiredArgsConstructor;
import org.springframework.http.*;
import org.springframework.web.bind.annotation.*;

import java.util.*;

@RestController
@RequestMapping("/api/termos")
@RequiredArgsConstructor
public class TermoController {
    private final TermoService service;
    private final TermoPdfService pdfService;

    @PostMapping
    public ResponseEntity<TermoResponse> create(@RequestBody TermoRequest req) {
        return ResponseEntity.status(HttpStatus.CREATED).body(service.create(req));
    }

    @GetMapping
    public List<TermoResponse> list() { return service.findAll(); }

    @GetMapping("/template")
    public TermoTemplateResponse getTemplate() { return service.getTemplate(); }

    @PutMapping("/template")
    public TermoTemplateResponse updateTemplate(@RequestBody TermoTemplateRequest req) { return service.updateTemplate(req); }

    @GetMapping("/{id}")
    public TermoResponse get(@PathVariable UUID id) { return service.findById(id); }

    @PutMapping("/{id}")
    public TermoResponse update(@PathVariable UUID id, @RequestBody TermoRequest req) { return service.update(id, req); }

    @PostMapping("/{id}/assinar")
    public TermoResponse sign(@PathVariable UUID id, @RequestBody AssinaturaRequest req, HttpServletRequest http) {
        String ip = Optional.ofNullable(http.getHeader("X-Forwarded-For")).map(v -> v.split(",")[0].trim()).orElse(http.getRemoteAddr());
        return service.sign(id, req, ip);
    }

    @PostMapping("/{id}/ocorrencias")
    public OcorrenciaResponse addOccurrence(@PathVariable UUID id, @RequestBody OcorrenciaRequest req) {
        return service.addOccurrence(id, req);
    }

    @GetMapping("/{id}/pdf")
    public ResponseEntity<byte[]> pdf(@PathVariable UUID id) {
        var termo = service.findById(id);
        return ResponseEntity.ok()
                .contentType(MediaType.APPLICATION_PDF)
                .header(HttpHeaders.CONTENT_DISPOSITION, "inline; filename=\"" + termo.numeroTermo() + ".pdf\"")
                .body(pdfService.generatePdf(id));
    }
}
