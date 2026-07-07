package br.com.nexusit.vault.bitwarden;

import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Service;

import java.security.PrivateKey;
import java.time.Instant;
import java.util.Base64;
import java.util.List;
import java.util.Map;

/**
 * Logs into the Vaultwarden service account once, derives the organization's
 * symmetric key, and caches everything in memory until the access token is
 * close to expiring. Nothing here is persisted to disk.
 */
@Service
@Slf4j
class VaultwardenSessionService {

    private final VaultwardenProperties props;
    private final VaultwardenClient client;

    private volatile Session cached;

    VaultwardenSessionService(VaultwardenProperties props, VaultwardenClient client) {
        this.props = props;
        this.client = client;
    }

    record Session(String accessToken, String organizationId, byte[] orgEncKey, byte[] orgMacKey, Instant expiresAt) {
        boolean isValid() {
            return Instant.now().isBefore(expiresAt);
        }
    }

    synchronized Session getSession() {
        if (cached != null && cached.isValid()) {
            return cached;
        }
        cached = login();
        return cached;
    }

    void invalidate() {
        cached = null;
    }

    private Session login() {
        try {
            String email = props.getEmail();
            String masterPassword = props.getMasterPassword();

            Map<String, Object> pre = client.prelogin(email);
            int kdf = intOf(pre.get("Kdf"), 0);
            int kdfIterations = intOf(pre.get("KdfIterations"), 600000);
            if (kdf != 0) {
                throw new IllegalStateException(
                        "A conta de serviço do Vaultwarden usa KDF Argon2id, que ainda não é suportado aqui. " +
                        "Troque o KDF dessa conta para PBKDF2-SHA256 em Configurações da Conta > Segurança > Chaves.");
            }

            byte[] masterKey = BitwardenCrypto.deriveMasterKey(masterPassword, email, kdfIterations);
            String serverHash = BitwardenCrypto.hashMasterPasswordForServer(masterKey, masterPassword);

            Map<String, Object> token = client.login(email, serverHash);
            String accessToken = (String) token.get("access_token");
            int expiresIn = intOf(token.get("expires_in"), 3600);
            String encryptedUserKey = (String) token.get("Key");
            String encryptedPrivateKey = (String) token.get("PrivateKey");
            if (accessToken == null || encryptedUserKey == null) {
                throw new IllegalStateException("Login no Vaultwarden não retornou access_token/Key — verifique email e senha mestra.");
            }

            byte[] stretchedEnc = BitwardenCrypto.hkdfExpandSingleBlock(masterKey, "enc");
            byte[] stretchedMac = BitwardenCrypto.hkdfExpandSingleBlock(masterKey, "mac");
            byte[] userKey = BitwardenCrypto.decryptCipherString(encryptedUserKey, stretchedEnc, stretchedMac);
            byte[] userEncKey = slice(userKey, 0, 32);
            byte[] userMacKey = slice(userKey, 32, 64);

            Map<String, Object> sync = client.sync(accessToken);
            log.info("Vaultwarden /sync chaves de topo: {}", sync.keySet());
            Map<String, Object> profile = firstMap(sync, "Profile", "profile");
            if (profile != null) {
                log.info("Vaultwarden /sync Profile chaves: {}", profile.keySet());
            }
            if (encryptedPrivateKey == null && profile != null) {
                encryptedPrivateKey = firstString(profile, "PrivateKey", "privateKey");
            }
            if (encryptedPrivateKey == null) {
                throw new IllegalStateException("Não foi possível obter a chave privada RSA da conta de serviço do Vaultwarden.");
            }
            byte[] privateKeyBytes = BitwardenCrypto.decryptCipherString(encryptedPrivateKey, userEncKey, userMacKey);
            PrivateKey privateKey = BitwardenCrypto.toRsaPrivateKey(privateKeyBytes);

            List<Map<String, Object>> orgs = firstList(profile, sync, "Organizations", "organizations");
            if (orgs == null) {
                throw new IllegalStateException("A conta de serviço do Vaultwarden não pertence a nenhuma organização.");
            }
            log.info("Vaultwarden organizações encontradas: {}", orgs.stream().map(o -> field(o, "Name", "name")).toList());
            Map<String, Object> targetOrg = orgs.stream()
                    .filter(o -> props.getOrganizationName().equalsIgnoreCase(String.valueOf(field(o, "Name", "name"))))
                    .findFirst()
                    .orElseThrow(() -> new IllegalStateException(
                            "Organização \"" + props.getOrganizationName() + "\" não encontrada nas organizações da conta de serviço."));

            String orgId = String.valueOf(field(targetOrg, "Id", "id"));
            String encryptedOrgKey = String.valueOf(field(targetOrg, "Key", "key"));
            byte[] rsaCiphertext = Base64.getDecoder().decode(stripCipherStringType(encryptedOrgKey));
            byte[] orgKey = BitwardenCrypto.rsaDecrypt(rsaCiphertext, privateKey);
            byte[] orgEncKey = slice(orgKey, 0, 32);
            byte[] orgMacKey = slice(orgKey, 32, 64);

            log.info("Sessão do Vaultwarden estabelecida para a organização \"{}\"", props.getOrganizationName());
            return new Session(accessToken, orgId, orgEncKey, orgMacKey, Instant.now().plusSeconds(Math.max(60, expiresIn - 60)));
        } catch (Exception e) {
            throw new IllegalStateException("Falha ao autenticar no Vaultwarden: " + e.getMessage(), e);
        }
    }

    private static String stripCipherStringType(String cipherString) {
        int dot = cipherString.indexOf('.');
        return dot >= 0 ? cipherString.substring(dot + 1) : cipherString;
    }

    private static byte[] slice(byte[] src, int from, int to) {
        byte[] out = new byte[to - from];
        System.arraycopy(src, from, out, 0, out.length);
        return out;
    }

    private static int intOf(Object value, int fallback) {
        if (value == null) return fallback;
        if (value instanceof Number n) return n.intValue();
        try { return Integer.parseInt(String.valueOf(value)); } catch (NumberFormatException e) { return fallback; }
    }

    private static Object field(Map<String, Object> m, String pascalKey, String camelKey) {
        if (m == null) return null;
        return m.containsKey(pascalKey) ? m.get(pascalKey) : m.get(camelKey);
    }

    private static String firstString(Map<String, Object> m, String pascalKey, String camelKey) {
        Object v = field(m, pascalKey, camelKey);
        return v != null ? String.valueOf(v) : null;
    }

    @SuppressWarnings("unchecked")
    private static Map<String, Object> firstMap(Map<String, Object> m, String pascalKey, String camelKey) {
        Object v = field(m, pascalKey, camelKey);
        return v instanceof Map ? (Map<String, Object>) v : null;
    }

    @SuppressWarnings("unchecked")
    private static List<Map<String, Object>> firstList(Map<String, Object> profile, Map<String, Object> sync, String pascalKey, String camelKey) {
        Object v = field(profile, pascalKey, camelKey);
        if (v == null) v = field(sync, pascalKey, camelKey);
        return v instanceof List ? (List<Map<String, Object>>) v : null;
    }
}
