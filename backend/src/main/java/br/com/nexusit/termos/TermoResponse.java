package br.com.nexusit.termos;

import java.time.*;
import java.util.*;

public record TermoResponse(
        UUID id,
        String numeroTermo,
        String responsavelNome,
        String cpf,
        String cargo,
        String setor,
        LocalDate dataEntrega,
        String tipoEquipamento,
        String marca,
        String modelo,
        String numeroSerie,
        String tombamento,
        String condicaoInicial,
        String observacoes,
        List<String> acessorios,
        TermoStatus status,
        boolean assinado,
        LocalDateTime dataHoraAssinatura,
        String ipAssinante,
        String hashDocumento,
        List<OcorrenciaResponse> ocorrencias,
        LocalDateTime createdAt,
        LocalDateTime updatedAt
) {}
