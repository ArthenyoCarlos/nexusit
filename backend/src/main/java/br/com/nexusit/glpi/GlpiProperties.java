package br.com.nexusit.glpi;

import lombok.Data;
import org.springframework.boot.context.properties.ConfigurationProperties;
import org.springframework.context.annotation.Configuration;

@Configuration
@ConfigurationProperties(prefix = "application.glpi")
@Data
public class GlpiProperties {
    private String apiUrl = "http://localhost/apirest.php";
    private String appToken = "";
    private String userToken = "";
}
