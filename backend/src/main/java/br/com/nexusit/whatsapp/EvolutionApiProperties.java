package br.com.nexusit.whatsapp;

import lombok.Data;
import org.springframework.boot.context.properties.ConfigurationProperties;
import org.springframework.context.annotation.Configuration;

@Configuration
@ConfigurationProperties(prefix = "application.whatsapp")
@Data
public class EvolutionApiProperties {
    private String baseUrl = "";
    private String apiKey = "";
    private String instanceName = "";
    private String webhookToken = "";

    public boolean isConfigured() {
        return !baseUrl.isBlank() && !apiKey.isBlank() && !instanceName.isBlank();
    }
}
