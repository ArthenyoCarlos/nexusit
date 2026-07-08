package br.com.nexusit.support;

public record InboundWhatsappMessage(
        String phoneNumber,
        String pushName,
        String text,
        byte[] mediaBytes,
        String mediaFilename,
        String mediaMime,
        String mediaKind
) {
    public boolean hasMedia() { return mediaBytes != null && mediaBytes.length > 0; }
    public boolean hasText() { return text != null && !text.isBlank(); }
    public boolean isAudio() { return mediaKind != null && mediaKind.equalsIgnoreCase("audio"); }
}
