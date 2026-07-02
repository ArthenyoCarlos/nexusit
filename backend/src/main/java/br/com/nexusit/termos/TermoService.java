package br.com.nexusit.termos;

import com.fasterxml.jackson.core.type.TypeReference;
import com.fasterxml.jackson.databind.ObjectMapper;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.server.ResponseStatusException;
import org.springframework.http.HttpStatus;

import java.nio.charset.StandardCharsets;
import java.security.MessageDigest;
import java.time.*;
import java.util.*;

@Service
@RequiredArgsConstructor
public class TermoService {
    private final TermoRepository termoRepository;
    private final OcorrenciaRepository ocorrenciaRepository;
    private final TermoTemplateRepository templateRepository;
    private final ObjectMapper mapper;

    public List<TermoResponse> findAll() {
        return termoRepository.findAll().stream()
                .sorted(Comparator.comparing(TermoResponsabilidade::getCreatedAt).reversed())
                .map(this::toResponse)
                .toList();
    }

    public TermoResponse findById(UUID id) { return toResponse(get(id)); }

    @Transactional
    public TermoResponse create(TermoRequest req) {
        var template = getTemplateEntity();
        var termo = TermoResponsabilidade.builder()
                .numeroTermo(nextNumber("TRM"))
                .responsavelNome(required(req.responsavelNome(), "responsavelNome"))
                .cpf(req.cpf())
                .cargo(req.cargo())
                .setor(req.setor())
                .dataEntrega(req.dataEntrega() != null ? req.dataEntrega() : LocalDate.now())
                .tipoEquipamento(required(req.tipoEquipamento(), "tipoEquipamento"))
                .marca(req.marca())
                .modelo(req.modelo())
                .numeroSerie(req.numeroSerie())
                .tombamento((req.tombamento() == null || req.tombamento().isBlank()) ? nextNumber("GAL") : req.tombamento().trim().toUpperCase())
                .condicaoInicial(req.condicaoInicial())
                .observacoes(req.observacoes())
                .acessoriosJson(writeAccessories(req.acessorios()))
                .status(req.status() != null ? req.status() : TermoStatus.ATIVO)
                .template(template)
                .build();
        return toResponse(termoRepository.save(termo));
    }

    @Transactional
    public TermoResponse update(UUID id, TermoRequest req) {
        var t = get(id);
        t.setResponsavelNome(required(req.responsavelNome(), "responsavelNome"));
        t.setCpf(req.cpf());
        t.setCargo(req.cargo());
        t.setSetor(req.setor());
        t.setDataEntrega(req.dataEntrega() != null ? req.dataEntrega() : t.getDataEntrega());
        t.setTipoEquipamento(required(req.tipoEquipamento(), "tipoEquipamento"));
        t.setMarca(req.marca());
        t.setModelo(req.modelo());
        t.setNumeroSerie(req.numeroSerie());
        if (req.tombamento() != null && !req.tombamento().isBlank()) t.setTombamento(req.tombamento().trim().toUpperCase());
        t.setCondicaoInicial(req.condicaoInicial());
        t.setObservacoes(req.observacoes());
        t.setAcessoriosJson(writeAccessories(req.acessorios()));
        if (req.status() != null) t.setStatus(req.status());
        return toResponse(termoRepository.save(t));
    }

    @Transactional
    public TermoResponse sign(UUID id, AssinaturaRequest req, String ip) {
        var t = get(id);
        if (req == null || req.assinaturaDigital() == null || req.assinaturaDigital().isBlank()) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Assinatura digital é obrigatória");
        }
        t.setAssinaturaDigital(req.assinaturaDigital());
        t.setDataHoraAssinatura(LocalDateTime.now());
        t.setIpAssinante(ip);
        t.setHashDocumento(hashFor(t));
        return toResponse(termoRepository.save(t));
    }

    @Transactional
    public OcorrenciaResponse addOccurrence(UUID termoId, OcorrenciaRequest req) {
        var termo = get(termoId);
        var o = OcorrenciaTermo.builder()
                .termo(termo)
                .data(req.data() != null ? req.data() : LocalDateTime.now())
                .tipo(req.tipo() != null ? req.tipo() : OcorrenciaTipo.OUTRO)
                .descricao(required(req.descricao(), "descricao"))
                .pecasSubstituidas(req.pecasSubstituidas())
                .custo(req.custo())
                .responsabilidade(req.responsabilidade())
                .registradoPor(req.registradoPor())
                .build();
        return toOccurrence(ocorrenciaRepository.save(o));
    }

    public TermoTemplateResponse getTemplate() { return toTemplate(getTemplateEntity()); }

    @Transactional
    public TermoTemplateResponse updateTemplate(TermoTemplateRequest req) {
        var t = getTemplateEntity();
        if (req.nome() != null && !req.nome().isBlank()) t.setNome(req.nome());
        if (req.clausulas() != null && !req.clausulas().isBlank()) t.setClausulas(req.clausulas());
        t.setLogoUrl(req.logoUrl());
        if (req.logoPosition() != null && !req.logoPosition().isBlank()) t.setLogoPosition(req.logoPosition());
        return toTemplate(templateRepository.save(t));
    }

    public TermoResponsabilidade get(UUID id) {
        return termoRepository.findById(id).orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "Termo não encontrado"));
    }

    private String nextNumber(String prefix) {
        int year = Year.now().getValue();
        String base = prefix + "-" + year + "-";
        Integer current = prefix.equals("TRM")
                ? termoRepository.maxNumeroTermoSeq(base)
                : termoRepository.maxTombamentoSeq(base);
        int n = (current == null ? 0 : current) + 1;
        return base + String.format("%03d", n);
    }

    private TermoTemplate getTemplateEntity() {
        return templateRepository.findFirstByOrderByCreatedAtAsc().orElseGet(() -> templateRepository.save(TermoTemplate.builder()
                .nome("Template padrão")
                .clausulas(defaultClauses())
                .logoPosition("TOPO_CENTRO")
                .build()));
    }

    String hashFor(TermoResponsabilidade t) {
        try {
            String payload = String.join("|",
                    n(t.getNumeroTermo()), n(t.getResponsavelNome()), n(t.getCpf()), n(t.getTombamento()),
                    n(t.getTipoEquipamento()), n(t.getMarca()), n(t.getModelo()), n(t.getNumeroSerie()),
                    n(t.getAcessoriosJson()), n(t.getDataHoraAssinatura()), n(t.getIpAssinante()));
            MessageDigest md = MessageDigest.getInstance("SHA-256");
            byte[] digest = md.digest(payload.getBytes(StandardCharsets.UTF_8));
            StringBuilder sb = new StringBuilder();
            for (byte b : digest) sb.append(String.format("%02x", b));
            return sb.toString();
        } catch (Exception e) { throw new IllegalStateException("Falha ao gerar hash", e); }
    }

    private TermoResponse toResponse(TermoResponsabilidade t) {
        return new TermoResponse(t.getId(), t.getNumeroTermo(), t.getResponsavelNome(), t.getCpf(), t.getCargo(), t.getSetor(),
                t.getDataEntrega(), t.getTipoEquipamento(), t.getMarca(), t.getModelo(), t.getNumeroSerie(), t.getTombamento(),
                t.getCondicaoInicial(), t.getObservacoes(), readAccessories(t.getAcessoriosJson()), t.getStatus(),
                t.getAssinaturaDigital() != null && !t.getAssinaturaDigital().isBlank(), t.getDataHoraAssinatura(), t.getIpAssinante(),
                t.getHashDocumento(), t.getOcorrencias().stream().map(this::toOccurrence).toList(), t.getCreatedAt(), t.getUpdatedAt());
    }

    private OcorrenciaResponse toOccurrence(OcorrenciaTermo o) {
        return new OcorrenciaResponse(o.getId(), o.getData(), o.getTipo(), o.getDescricao(), o.getPecasSubstituidas(), o.getCusto(), o.getResponsabilidade(), o.getRegistradoPor());
    }

    private TermoTemplateResponse toTemplate(TermoTemplate t) { return new TermoTemplateResponse(t.getId(), t.getNome(), t.getClausulas(), t.getLogoUrl(), t.getLogoPosition()); }

    private String writeAccessories(List<String> items) {
        try { return mapper.writeValueAsString(items == null ? List.of() : items.stream().filter(s -> s != null && !s.isBlank()).map(String::trim).toList()); }
        catch (Exception e) { return "[]"; }
    }
    private List<String> readAccessories(String json) {
        try { return json == null || json.isBlank() ? List.of() : mapper.readValue(json, new TypeReference<List<String>>() {}); }
        catch (Exception e) { return List.of(); }
    }
    private String required(String s, String field) { if (s == null || s.isBlank()) throw new ResponseStatusException(HttpStatus.BAD_REQUEST, field + " é obrigatório"); return s.trim(); }
    private String n(Object v) { return v == null ? "" : String.valueOf(v); }
    private String defaultClauses() { return "1. Responsabilidade por danos causados por mau uso.\n\n2. Obrigação de devolução no desligamento.\n\n3. Proibição de uso pessoal excessivo.\n\n4. Responsabilidade por perda ou roubo sem boletim de ocorrência.\n\n5. Aceite das políticas de TI da empresa."; }
}
