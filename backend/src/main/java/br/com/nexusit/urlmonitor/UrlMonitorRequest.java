package br.com.nexusit.urlmonitor;

import jakarta.validation.constraints.NotBlank;

public record UrlMonitorRequest(
        @NotBlank String name,
        @NotBlank String url,
        Boolean enabled,
        Integer intervalSec
) {}
