package br.com.nexusit.termos;

import java.time.*;
import java.util.*;

public record TermoRequest(
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
        TermoStatus status
) {}
