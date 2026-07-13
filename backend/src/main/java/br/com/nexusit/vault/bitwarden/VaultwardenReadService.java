package br.com.nexusit.vault.bitwarden;

import br.com.nexusit.audit.AuditModule;
import br.com.nexusit.audit.AuditService;
import br.com.nexusit.user.User;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Service;

import java.nio.charset.StandardCharsets;
import java.util.List;
import java.util.Map;

/**
 * Reads back items that already exist in the Vaultwarden organization
 * (created directly in Vaultwarden, not through NexusIT) so they can be
 * displayed inside the NexusIT Cofre. Read-only: nothing here is written
 * back to Vaultwarden or persisted locally.
 */
@Service
@RequiredArgsConstructor
@Slf4j
public class VaultwardenReadService {

    private static final int CIPHER_TYPE_LOGIN = 1;

    private final VaultwardenProperties props;
    private final VaultwardenClient client;
    private final VaultwardenSessionService sessionService;
    private final AuditService auditService;

    public List<VaultwardenCipherSummary> listOrganizationLogins() {
        if (!props.isConfigured()) {
            log.info("Integração com Vaultwarden desligada (VAULTWARDEN_BASE_URL/EMAIL/MASTER_PASSWORD não configurados)");
            return List.of();
        }
        try {
            VaultwardenSessionService.Session session = sessionService.getSession();
            Map<String, Object> sync = client.sync(session.accessToken());
            log.info("Vaultwarden /sync top-level keys: {}", sync.keySet());

            List<Map<String, Object>> ciphers = listOf(sync.get("Ciphers"), sync.get("ciphers"));
            log.info("Vaultwarden /sync retornou {} ciphers no total (sessão organizationId={})", ciphers.size(), session.organizationId());
            if (!ciphers.isEmpty()) {
                Map<String, Object> first = ciphers.get(0);
                log.info("Vaultwarden primeiro cipher — chaves: {}", first.keySet());
                log.info("Vaultwarden primeiro cipher — OrganizationId/organizationId={}, Type/type={}, DeletedDate/deletedDate={}",
                        field(first, "OrganizationId", "organizationId"),
                        field(first, "Type", "type"),
                        field(first, "DeletedDate", "deletedDate"));
            }

            long afterOrg = ciphers.stream().filter(c -> session.organizationId().equals(String.valueOf(field(c, "OrganizationId", "organizationId")))).count();
            long afterType = ciphers.stream().filter(c -> intField(c, "Type", "type") == CIPHER_TYPE_LOGIN).count();
            log.info("Vaultwarden ciphers após filtro de organização: {}, após filtro de tipo Login: {}", afterOrg, afterType);

            return ciphers.stream()
                    .filter(c -> session.organizationId().equals(String.valueOf(field(c, "OrganizationId", "organizationId"))))
                    .filter(c -> intField(c, "Type", "type") == CIPHER_TYPE_LOGIN)
                    .filter(c -> field(c, "DeletedDate", "deletedDate") == null)
                    .map(c -> toSummary(c, session))
                    .filter(s -> s != null)
                    .toList();
        } catch (Exception e) {
            log.warn("Não foi possível listar itens do Vaultwarden: {}", e.getMessage(), e);
            return List.of();
        }
    }

    public String revealPassword(String cipherId, User currentUser) {
        VaultwardenSessionService.Session session = sessionService.getSession();
        Map<String, Object> sync = client.sync(session.accessToken());
        List<Map<String, Object>> ciphers = listOf(sync.get("Ciphers"), sync.get("ciphers"));

        Map<String, Object> cipher = ciphers.stream()
                .filter(c -> cipherId.equals(String.valueOf(field(c, "Id", "id"))))
                .findFirst()
                .orElseThrow(() -> new IllegalArgumentException("Item não encontrado no Vaultwarden"));

        String name = decryptOrNull((String) field(cipher, "Name", "name"), session);
        auditService.log(AuditModule.VAULT, "REVEAL_SECRET", currentUser, "VAULTWARDEN_ITEM", null,
                name != null ? name : cipherId, null);

        Map<String, Object> login = asMap(field(cipher, "Login", "login"));
        String encryptedPassword = login != null ? (String) field(login, "Password", "password") : null;
        if (encryptedPassword == null) return "";

        try {
            byte[] decrypted = BitwardenCrypto.decryptCipherString(encryptedPassword, session.orgEncKey(), session.orgMacKey());
            return new String(decrypted, StandardCharsets.UTF_8);
        } catch (Exception e) {
            throw new IllegalStateException("Falha ao decifrar a senha do Vaultwarden: " + e.getMessage(), e);
        }
    }

    private VaultwardenCipherSummary toSummary(Map<String, Object> cipher, VaultwardenSessionService.Session session) {
        try {
            String id = String.valueOf(field(cipher, "Id", "id"));
            String name = decryptOrNull((String) field(cipher, "Name", "name"), session);
            Map<String, Object> login = asMap(field(cipher, "Login", "login"));
            String username = login != null ? decryptOrNull((String) field(login, "Username", "username"), session) : null;
            String uri = login != null ? decryptOrNull((String) field(login, "Uri", "uri"), session) : null;
            return new VaultwardenCipherSummary(id, name != null ? name : "(sem nome)", username, uri);
        } catch (Exception e) {
            log.warn("Ignorando item do Vaultwarden que não pôde ser decifrado: {}", e.getMessage());
            return null;
        }
    }

    private String decryptOrNull(String cipherString, VaultwardenSessionService.Session session) throws Exception {
        if (cipherString == null || cipherString.isBlank()) return null;
        byte[] decrypted = BitwardenCrypto.decryptCipherString(cipherString, session.orgEncKey(), session.orgMacKey());
        return new String(decrypted, StandardCharsets.UTF_8);
    }

    @SuppressWarnings("unchecked")
    private static List<Map<String, Object>> listOf(Object a, Object b) {
        Object v = a != null ? a : b;
        return v instanceof List ? (List<Map<String, Object>>) v : List.of();
    }

    @SuppressWarnings("unchecked")
    private static Map<String, Object> asMap(Object o) {
        return o instanceof Map ? (Map<String, Object>) o : null;
    }

    private static Object field(Map<String, Object> m, String pascalKey, String camelKey) {
        return m.containsKey(pascalKey) ? m.get(pascalKey) : m.get(camelKey);
    }

    private static int intField(Map<String, Object> m, String pascalKey, String camelKey) {
        Object v = field(m, pascalKey, camelKey);
        if (v instanceof Number n) return n.intValue();
        try { return Integer.parseInt(String.valueOf(v)); } catch (Exception e) { return -1; }
    }
}
