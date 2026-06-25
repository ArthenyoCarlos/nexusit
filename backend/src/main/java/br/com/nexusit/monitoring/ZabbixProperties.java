package br.com.nexusit.monitoring;

import lombok.Data;
import org.springframework.boot.context.properties.ConfigurationProperties;
import org.springframework.context.annotation.Configuration;

@Configuration
@ConfigurationProperties(prefix = "application.zabbix")
@Data
public class ZabbixProperties {
    private String apiUrl = "http://localhost/api_jsonrpc.php";
    private String user = "admin";
    private String password = "";
}
