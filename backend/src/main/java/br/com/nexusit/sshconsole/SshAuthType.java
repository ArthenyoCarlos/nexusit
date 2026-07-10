package br.com.nexusit.sshconsole;

public enum SshAuthType {
    PASSWORD,
    PRIVATE_KEY;

    public static SshAuthType fromNullable(String value) {
        if (value == null || value.isBlank()) return PASSWORD;
        return SshAuthType.valueOf(value.trim().toUpperCase());
    }
}
