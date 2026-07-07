package br.com.nexusit.sshconsole;

import java.nio.charset.StandardCharsets;
import java.security.MessageDigest;
import java.security.NoSuchAlgorithmException;
import java.util.Base64;

/**
 * Computes host key fingerprints in the same SHA256 format OpenSSH's
 * {@code ssh-keygen -lf} prints, so an admin can cross-check a stored
 * fingerprint against the real server.
 */
final class SshFingerprint {

    private SshFingerprint() {}

    static String of(String base64Key) {
        try {
            byte[] keyBlob = Base64.getDecoder().decode(base64Key.getBytes(StandardCharsets.US_ASCII));
            byte[] digest = MessageDigest.getInstance("SHA-256").digest(keyBlob);
            return "SHA256:" + Base64.getEncoder().withoutPadding().encodeToString(digest);
        } catch (NoSuchAlgorithmException e) {
            throw new IllegalStateException(e);
        }
    }
}
