package br.com.nexusit.vault.bitwarden;

import org.junit.jupiter.api.Test;

import java.nio.charset.StandardCharsets;
import java.security.SecureRandom;

import static org.junit.jupiter.api.Assertions.assertArrayEquals;
import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertNotEquals;
import static org.junit.jupiter.api.Assertions.assertThrows;

class BitwardenCryptoTest {

    @Test
    void encryptToCipherString_roundTripsThroughDecrypt() throws Exception {
        byte[] encKey = randomBytes(32);
        byte[] macKey = randomBytes(32);
        String plaintext = "senha-super-secreta-123!";

        String cipherString = BitwardenCrypto.encryptToCipherString(plaintext, encKey, macKey);
        byte[] decrypted = BitwardenCrypto.decryptCipherString(cipherString, encKey, macKey);

        assertEquals(plaintext, new String(decrypted, StandardCharsets.UTF_8));
        assertEquals('2', cipherString.charAt(0));
    }

    @Test
    void decryptCipherString_rejectsTamperedCiphertext() throws Exception {
        byte[] encKey = randomBytes(32);
        byte[] macKey = randomBytes(32);
        String cipherString = BitwardenCrypto.encryptToCipherString("valor-original", encKey, macKey);

        String[] parts = cipherString.substring(2).split("\\|");
        byte[] ct = java.util.Base64.getDecoder().decode(parts[1]);
        ct[0] ^= 0x01;
        String tampered = "2." + parts[0] + "|" + java.util.Base64.getEncoder().encodeToString(ct) + "|" + parts[2];

        assertThrows(SecurityException.class, () -> BitwardenCrypto.decryptCipherString(tampered, encKey, macKey));
    }

    @Test
    void deriveMasterKey_isDeterministicForSameInputs() throws Exception {
        byte[] a = BitwardenCrypto.deriveMasterKey("minhaSenha123", "user@example.com", 5000);
        byte[] b = BitwardenCrypto.deriveMasterKey("minhaSenha123", "USER@EXAMPLE.COM", 5000);
        byte[] c = BitwardenCrypto.deriveMasterKey("outraSenha", "user@example.com", 5000);

        assertEquals(32, a.length);
        assertArrayEquals(a, b, "email deve ser normalizado para minusculo, resultado deve ser igual");
        assertNotEquals(bytesToHex(a), bytesToHex(c));
    }

    @Test
    void hkdfExpandSingleBlock_producesDistinctKeysForDifferentInfo() throws Exception {
        byte[] prk = randomBytes(32);
        byte[] encKey = BitwardenCrypto.hkdfExpandSingleBlock(prk, "enc");
        byte[] macKey = BitwardenCrypto.hkdfExpandSingleBlock(prk, "mac");

        assertEquals(32, encKey.length);
        assertEquals(32, macKey.length);
        assertNotEquals(bytesToHex(encKey), bytesToHex(macKey));
    }

    @Test
    void rsaRoundTrip_decryptsWhatItEncrypted() throws Exception {
        java.security.KeyPairGenerator gen = java.security.KeyPairGenerator.getInstance("RSA");
        gen.initialize(2048);
        java.security.KeyPair pair = gen.generateKeyPair();

        byte[] orgKey = randomBytes(64);
        javax.crypto.Cipher cipher = javax.crypto.Cipher.getInstance("RSA/ECB/OAEPWithSHA-1AndMGF1Padding");
        cipher.init(javax.crypto.Cipher.ENCRYPT_MODE, pair.getPublic());
        byte[] encrypted = cipher.doFinal(orgKey);

        byte[] decrypted = BitwardenCrypto.rsaDecrypt(encrypted, pair.getPrivate());
        assertArrayEquals(orgKey, decrypted);
    }

    private static byte[] randomBytes(int len) {
        byte[] b = new byte[len];
        new SecureRandom().nextBytes(b);
        return b;
    }

    private static String bytesToHex(byte[] bytes) {
        StringBuilder sb = new StringBuilder();
        for (byte b : bytes) sb.append(String.format("%02x", b));
        return sb.toString();
    }
}
