package br.com.nexusit.termos;

import java.math.BigDecimal;
import java.time.LocalDateTime;
import java.util.UUID;

public record OcorrenciaResponse(
        UUID id,
        LocalDateTime data,
        OcorrenciaTipo tipo,
        String descricao,
        String pecasSubstituidas,
        BigDecimal custo,
        ResponsabilidadeOcorrencia responsabilidade,
        String registradoPor
) {}
