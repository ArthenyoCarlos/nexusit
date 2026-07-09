package br.com.nexusit.push;

import lombok.Data;
import org.springframework.boot.context.properties.ConfigurationProperties;
import org.springframework.context.annotation.Configuration;

@Configuration
@ConfigurationProperties(prefix = "application.firebase")
@Data
public class FirebaseProperties {
    private String credentialsPath = "";
}
