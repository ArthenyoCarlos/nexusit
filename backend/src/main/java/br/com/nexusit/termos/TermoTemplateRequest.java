package br.com.nexusit.termos;

import java.util.UUID;

public record TermoTemplateRequest(String nome, String clausulas, String logoUrl, String logoPosition) {}
