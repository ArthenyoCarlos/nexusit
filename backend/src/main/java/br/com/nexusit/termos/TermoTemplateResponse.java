package br.com.nexusit.termos;

import java.util.UUID;

public record TermoTemplateResponse(UUID id, String nome, String clausulas, String logoUrl, String logoPosition) {}
