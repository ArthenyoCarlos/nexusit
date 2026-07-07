package br.com.nexusit.vault.bitwarden;

import lombok.Data;
import org.springframework.boot.context.properties.ConfigurationProperties;
import org.springframework.context.annotation.Configuration;

@Configuration
@ConfigurationProperties(prefix = "application.vaultwarden")
@Data
public class VaultwardenProperties {
    private String baseUrl = "";
    private String email = "";
    private String masterPassword = "";
    private String organizationName = "Armazem Galdino";

    public boolean isConfigured() {
        return !baseUrl.isBlank() && !email.isBlank() && !masterPassword.isBlank();
    }
}
