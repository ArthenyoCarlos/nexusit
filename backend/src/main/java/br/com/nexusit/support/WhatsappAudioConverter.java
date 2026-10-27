package br.com.nexusit.support;

import org.springframework.http.HttpStatus;
import org.springframework.web.server.ResponseStatusException;
import java.io.IOException;
import java.nio.charset.StandardCharsets;
import java.nio.file.*;
import java.time.Duration;
import java.util.concurrent.TimeUnit;

/** Bounded, local ffmpeg conversion. Neither stderr nor stdout is read before waitFor. */
public class WhatsappAudioConverter {
    public record Audio(byte[] bytes, String filename, String mime) {}
    private final String executable;
    private final Duration timeout;
    public WhatsappAudioConverter() { this("ffmpeg", Duration.ofSeconds(120)); }
    WhatsappAudioConverter(String executable, Duration timeout) { this.executable = executable; this.timeout = timeout; }

    public Audio convert(byte[] input, String filename) {
        if (input == null || input.length == 0) throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Áudio vazio");
        if (input.length > 32L * 1024 * 1024) throw new ResponseStatusException(HttpStatus.PAYLOAD_TOO_LARGE, "Áudio excede 32 MB");
        Path in = null, out = null, log = null;
        Process process = null;
        try {
            in = Files.createTempFile("nexusit-audio-in-", ".audio");
            out = Files.createTempFile("nexusit-audio-out-", ".ogg");
            log = Files.createTempFile("nexusit-audio-log-", ".log");
            Files.write(in, input);
            process = new ProcessBuilder(executable, "-nostdin", "-y", "-hide_banner", "-loglevel", "error",
                    "-i", in.toString(), "-map", "0:a:0", "-vn", "-c:a", "libopus", "-b:a", "32k",
                    "-ar", "48000", "-ac", "1", "-fs", "16777217", out.toString())
                    .redirectErrorStream(true).redirectOutput(log.toFile()).start();
            if (!process.waitFor(timeout.toMillis(), TimeUnit.MILLISECONDS)) {
                process.destroyForcibly();
                throw new ResponseStatusException(HttpStatus.GATEWAY_TIMEOUT, "Conversão de áudio excedeu o tempo limite; nada foi enviado");
            }
            if (process.exitValue() != 0) throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Áudio inválido ou formato não suportado; nada foi enviado");
            long size = Files.size(out);
            if (size > 16L * 1024 * 1024) throw new ResponseStatusException(HttpStatus.PAYLOAD_TOO_LARGE, "Áudio convertido excede 16 MB");
            byte[] converted = Files.readAllBytes(out);
            String header = new String(converted, 0, Math.min(converted.length, 256), StandardCharsets.ISO_8859_1);
            if (!header.startsWith("OggS") || !header.contains("OpusHead"))
                throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Conversão não produziu OGG/Opus válido");
            String base = filename == null ? "audio" : filename.replaceAll("[\\r\\n\\t/\\\\]", "_");
            int dot = base.lastIndexOf('.');
            return new Audio(converted, (dot > 0 ? base.substring(0, dot) : base) + ".ogg", "audio/ogg; codecs=opus");
        } catch (IOException e) {
            throw new ResponseStatusException(HttpStatus.SERVICE_UNAVAILABLE, "Conversor de áudio indisponível; nada foi enviado");
        } catch (InterruptedException e) {
            Thread.currentThread().interrupt();
            throw new ResponseStatusException(HttpStatus.SERVICE_UNAVAILABLE, "Conversão interrompida; nada foi enviado");
        } finally {
            if (process != null && process.isAlive()) process.destroyForcibly();
            for (Path path : new Path[]{in, out, log}) if (path != null) try { Files.deleteIfExists(path); } catch (IOException ignored) { }
        }
    }
}
