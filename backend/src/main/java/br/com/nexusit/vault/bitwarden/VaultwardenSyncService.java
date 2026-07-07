package br.com.nexusit.vault.bitwarden;

import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Service;

import java.util.HashMap;
import java.util.LinkedHashMap;
import java.util.Map;
import java.util.Optional;

/**
 * Best-effort push of NexusIT vault credentials into Vaultwarden. Never
 * throws — a failure here must never block or roll back the local save in
 * CredentialService, since the encrypted local copy is the source of truth
 * and Vaultwarden is a mirror.
 */
@Service
@RequiredArgsConstructor
@Slf4j
public class VaultwardenSyncService {

    private static final int CIPHER_TYPE_LOGIN = 1;

    private final VaultwardenProperties props;
    private final VaultwardenClient client;
    private final VaultwardenSessionService sessionService;

    public Optional<String> pushCredential(String title, String username, String plainSecret, String url) {
        if (!props.isConfigured()) {
            return Optional.empty();
        }
        try {
            VaultwardenSessionService.Session session = sessionService.getSession();
            Map<String, Object> body = buildCipherBody(title, username, plainSecret, url, session);
            Map<String, Object> created = client.createCipher(session.accessToken(), body);
            Object id = created != null ? created.get("Id") : null;
            if (id == null) {
                log.warn("Vaultwarden não retornou Id ao criar o item \"{}\"", title);
                return Optional.empty();
            }
            log.info("Credencial \"{}\" replicada no Vaultwarden (id={})", title, id);
            return Optional.of(String.valueOf(id));
        } catch (Exception e) {
            log.warn("Não foi possível replicar a credencial \"{}\" no Vaultwarden: {}", title, e.getMessage());
            sessionService.invalidate();
            return Optional.empty();
        }
    }

    private Map<String, Object> buildCipherBody(String title, String username, String plainSecret, String url,
                                                 VaultwardenSessionService.Session session) throws Exception {
        byte[] encKey = session.orgEncKey();
        byte[] macKey = session.orgMacKey();

        Map<String, Object> login = new LinkedHashMap<>();
        login.put("username", username != null && !username.isBlank()
                ? BitwardenCrypto.encryptToCipherString(username, encKey, macKey) : null);
        login.put("password", BitwardenCrypto.encryptToCipherString(plainSecret, encKey, macKey));
        login.put("uri", url != null && !url.isBlank()
                ? BitwardenCrypto.encryptToCipherString(url, encKey, macKey) : null);
        login.put("totp", null);

        Map<String, Object> body = new HashMap<>();
        body.put("type", CIPHER_TYPE_LOGIN);
        body.put("organizationId", session.organizationId());
        body.put("name", BitwardenCrypto.encryptToCipherString(title, encKey, macKey));
        body.put("notes", null);
        body.put("favorite", false);
        body.put("login", login);
        return body;
    }
}
