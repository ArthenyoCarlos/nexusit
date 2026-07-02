package br.com.nexusit.termos;

import java.math.BigDecimal;
import java.time.LocalDateTime;

public record OcorrenciaRequest(
        LocalDateTime data,
        OcorrenciaTipo tipo,
        String descricao,
        String pecasSubstituidas,
        BigDecimal custo,
        ResponsabilidadeOcorrencia responsabilidade,
        String registradoPor
) {}
