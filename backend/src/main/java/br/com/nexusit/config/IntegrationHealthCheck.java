package br.com.nexusit.config;

import br.com.nexusit.glpi.GlpiProperties;
import br.com.nexusit.monitoring.ZabbixProperties;
import br.com.nexusit.vault.bitwarden.VaultwardenProperties;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.boot.context.event.ApplicationReadyEvent;
import org.springframework.context.event.EventListener;
import org.springframework.stereotype.Component;

/**
 * Logs, once at startup, which external integrations are missing required
 * configuration. Every one of these fails silently at runtime otherwise
 * (safeCall-style fallbacks), so a misconfigured env var only shows up as
 * "nothing works" hours later — this puts it in the log on day one.
 */
@Component
@RequiredArgsConstructor
@Slf4j
public class IntegrationHealthCheck {

    private final GlpiProperties glpi;
    private final ZabbixProperties zabbix;
    private final VaultwardenProperties vaultwarden;

    @EventListener(ApplicationReadyEvent.class)
    public void checkOnStartup() {
        log.info("── Verificação de integrações externas ──");
        check("GLPI", glpi.getAppToken().isBlank() || glpi.getUserToken().isBlank(),
                "GLPI_APP_TOKEN/GLPI_USER_TOKEN não configurados — chamados GLPI não vão funcionar");
        check("Zabbix", zabbix.getPassword().isBlank(),
                "ZABBIX_PASSWORD não configurado — monitoramento Zabbix não vai funcionar");
        check("Vaultwarden", !vaultwarden.isConfigured(),
                "VAULTWARDEN_BASE_URL/EMAIL/MASTER_PASSWORD não configurados — sincronização com o Vaultwarden está desligada");
        log.info("──────────────────────────────────────────");
    }

    private void check(String name, boolean missing, String message) {
        if (missing) {
            log.warn("[{}] NÃO configurado — {}", name, message);
        } else {
            log.info("[{}] configurado", name);
        }
    }
}
