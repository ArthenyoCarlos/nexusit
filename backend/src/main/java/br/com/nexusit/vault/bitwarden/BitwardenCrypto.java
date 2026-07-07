package br.com.nexusit.vault.bitwarden;

import javax.crypto.Cipher;
import javax.crypto.Mac;
import javax.crypto.spec.IvParameterSpec;
import javax.crypto.spec.SecretKeySpec;
import java.nio.charset.StandardCharsets;
import java.security.GeneralSecurityException;
import java.security.KeyFactory;
import java.security.MessageDigest;
import java.security.PrivateKey;
import java.security.SecureRandom;
import java.security.spec.PKCS8EncodedKeySpec;
import java.util.Base64;
import java.util.Locale;

/**
 * Reimplements the client-side pieces of the Bitwarden/Vaultwarden crypto
 * scheme that are needed to log in as a real account and create vault items
 * server-side, without depending on the official bw CLI or SDK.
 *
 * PBKDF2 here is hand-rolled (not javax.crypto.spec.PBEKeySpec) because the
 * "password" input for several of these derivations is raw key bytes, not
 * text — PBEKeySpec only accepts char[] and re-encodes it, which corrupts
 * binary input.
 */
final class BitwardenCrypto {

    private BitwardenCrypto() {}

    static byte[] deriveMasterKey(String masterPassword, String email, int iterations) throws GeneralSecurityException {
        byte[] salt = email.trim().toLowerCase(Locale.ROOT).getBytes(StandardCharsets.UTF_8);
        return pbkdf2Sha256(masterPassword.getBytes(StandardCharsets.UTF_8), salt, iterations);
    }

    static String hashMasterPasswordForServer(byte[] masterKey, String masterPassword) throws GeneralSecurityException {
        byte[] hash = pbkdf2Sha256(masterKey, masterPassword.getBytes(StandardCharsets.UTF_8), 1);
        return Base64.getEncoder().encodeToString(hash);
    }

    static byte[] hkdfExpandSingleBlock(byte[] prk, String info) throws GeneralSecurityException {
        Mac mac = Mac.getInstance("HmacSHA256");
        mac.init(new SecretKeySpec(prk, "HmacSHA256"));
        mac.update(info.getBytes(StandardCharsets.US_ASCII));
        mac.update((byte) 1);
        return mac.doFinal();
    }

    /** CipherString format: "{type}.{iv_b64}|{ct_b64}[|{mac_b64}]". */
    static byte[] decryptCipherString(String cipherString, byte[] encKey, byte[] macKey) throws GeneralSecurityException {
        int dot = cipherString.indexOf('.');
        String body = dot >= 0 ? cipherString.substring(dot + 1) : cipherString;
        String[] parts = body.split("\\|");
        byte[] iv = Base64.getDecoder().decode(parts[0]);
        byte[] ct = Base64.getDecoder().decode(parts[1]);

        if (parts.length > 2 && macKey != null) {
            byte[] expectedMac = Base64.getDecoder().decode(parts[2]);
            Mac hmac = Mac.getInstance("HmacSHA256");
            hmac.init(new SecretKeySpec(macKey, "HmacSHA256"));
            hmac.update(iv);
            hmac.update(ct);
            if (!MessageDigest.isEqual(hmac.doFinal(), expectedMac)) {
                throw new SecurityException("HMAC invalido ao decifrar CipherString do Vaultwarden");
            }
        }

        Cipher cipher = Cipher.getInstance("AES/CBC/PKCS5Padding");
        cipher.init(Cipher.DECRYPT_MODE, new SecretKeySpec(encKey, "AES"), new IvParameterSpec(iv));
        return cipher.doFinal(ct);
    }

    static String encryptToCipherString(byte[] plaintext, byte[] encKey, byte[] macKey) throws GeneralSecurityException {
        byte[] iv = new byte[16];
        new SecureRandom().nextBytes(iv);

        Cipher cipher = Cipher.getInstance("AES/CBC/PKCS5Padding");
        cipher.init(Cipher.ENCRYPT_MODE, new SecretKeySpec(encKey, "AES"), new IvParameterSpec(iv));
        byte[] ct = cipher.doFinal(plaintext);

        Mac hmac = Mac.getInstance("HmacSHA256");
        hmac.init(new SecretKeySpec(macKey, "HmacSHA256"));
        hmac.update(iv);
        hmac.update(ct);
        byte[] mac = hmac.doFinal();

        Base64.Encoder b64 = Base64.getEncoder();
        return "2." + b64.encodeToString(iv) + "|" + b64.encodeToString(ct) + "|" + b64.encodeToString(mac);
    }

    static String encryptToCipherString(String plaintext, byte[] encKey, byte[] macKey) throws GeneralSecurityException {
        return encryptToCipherString(plaintext.getBytes(StandardCharsets.UTF_8), encKey, macKey);
    }

    static PrivateKey toRsaPrivateKey(byte[] pkcs8Der) throws GeneralSecurityException {
        KeyFactory kf = KeyFactory.getInstance("RSA");
        return kf.generatePrivate(new PKCS8EncodedKeySpec(pkcs8Der));
    }

    static byte[] rsaDecrypt(byte[] encrypted, PrivateKey privateKey) throws GeneralSecurityException {
        Cipher cipher = Cipher.getInstance("RSA/ECB/OAEPWithSHA-1AndMGF1Padding");
        cipher.init(Cipher.DECRYPT_MODE, privateKey);
        return cipher.doFinal(encrypted);
    }

    /** PBKDF2-HMAC-SHA256, single 32-byte block (RFC 8018 F-function with i=1). */
    private static byte[] pbkdf2Sha256(byte[] password, byte[] salt, int iterations) throws GeneralSecurityException {
        Mac mac = Mac.getInstance("HmacSHA256");
        mac.init(new SecretKeySpec(password, "HmacSHA256"));

        mac.update(salt);
        mac.update(new byte[]{0, 0, 0, 1});
        byte[] u = mac.doFinal();
        byte[] result = u.clone();

        for (int i = 1; i < iterations; i++) {
            u = mac.doFinal(u);
            for (int k = 0; k < result.length; k++) result[k] ^= u[k];
        }
        return result;
    }
}
