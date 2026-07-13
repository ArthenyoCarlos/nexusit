package br.com.nexusit.sshconsole;

import br.com.nexusit.audit.AuditModule;
import br.com.nexusit.audit.AuditService;
import br.com.nexusit.user.User;
import br.com.nexusit.user.UserRepository;
import br.com.nexusit.vault.CryptoService;
import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.jcraft.jsch.ChannelShell;
import com.jcraft.jsch.JSch;
import com.jcraft.jsch.JSchException;
import com.jcraft.jsch.Session;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.security.core.Authentication;
import org.springframework.security.core.GrantedAuthority;
import org.springframework.stereotype.Component;
import org.springframework.web.socket.CloseStatus;
import org.springframework.web.socket.TextMessage;
import org.springframework.web.socket.WebSocketSession;
import org.springframework.web.socket.handler.TextWebSocketHandler;

import java.io.InputStreamReader;
import java.io.OutputStream;
import java.io.Reader;
import java.nio.charset.StandardCharsets;
import java.util.Map;
import java.util.UUID;
import java.util.concurrent.ConcurrentHashMap;

/**
 * Bridges a browser WebSocket to an interactive SSH shell via JSch.
 * Client -> server frames are small JSON envelopes ({"type":"input"|"resize", ...});
 * server -> client frames are always raw terminal output, never wrapped, so the
 * frontend can feed them straight into xterm.js without parsing.
 */
@Component
@RequiredArgsConstructor
@Slf4j
public class SshWebSocketHandler extends TextWebSocketHandler {

    private static final int CONNECT_TIMEOUT_MS = 8000;

    private final SshHostRepository hostRepo;
    private final CryptoService crypto;
    private final ObjectMapper objectMapper;
    private final UserRepository userRepo;
    private final AuditService auditService;

    private final Map<String, Bridge> bridges = new ConcurrentHashMap<>();

    @Override
    public void afterConnectionEstablished(WebSocketSession wsSession) {
        UUID hostId;
        try {
            hostId = extractHostId(wsSession);
        } catch (Exception e) {
            closeQuietly(wsSession, 4000, "id invalido");
            return;
        }

        if (!isAdmin(wsSession)) {
            closeQuietly(wsSession, 4003, "acesso negado");
            return;
        }

        SshHost host = hostRepo.findById(hostId).orElse(null);
        if (host == null) {
            closeQuietly(wsSession, 4004, "maquina nao encontrada");
            return;
        }

        JSch jsch = new JSch();
        try {
            configureIdentity(jsch, host);
        } catch (Exception e) {
            log.warn("Falha ao preparar credenciais SSH da máquina {}: {}", host.getId(), e.toString());
            closeQuietly(wsSession, 4005, "erro ao ler credenciais");
            return;
        }

        Session jschSession = null;
        ChannelShell channel = null;
        try {
            jschSession = jsch.getSession(host.getUsername(), host.getHost(), host.getPort());
            if ((host.getAuthType() == null || host.getAuthType() == SshAuthType.PASSWORD) && host.getEncryptedPassword() != null) {
                jschSession.setPassword(crypto.decrypt(host.getEncryptedPassword()));
            }
            jschSession.setConfig("StrictHostKeyChecking", "no");
            jschSession.connect(CONNECT_TIMEOUT_MS);

            String fingerprint = SshFingerprint.of(jschSession.getHostKey().getKey());
            String stored = host.getHostKeyFingerprint();
            if (stored == null) {
                host.setHostKeyFingerprint(fingerprint);
                hostRepo.save(host);
                log.info("SSH: chave do host {} ({}) registrada na primeira conexão", host.getName(), host.getHost());
            } else if (!stored.equals(fingerprint)) {
                log.warn("SSH: chave do host {} ({}) mudou! esperado={} recebido={}", host.getName(), host.getHost(), stored, fingerprint);
                auditService.log(AuditModule.SSH_CONSOLE, "HOST_KEY_MISMATCH", resolveUser(wsSession), "SSH_HOST", host.getId(), host.getName(),
                        "esperado=" + stored + " recebido=" + fingerprint);
                jschSession.disconnect();
                closeQuietly(wsSession, 4006, "chave do host mudou");
                return;
            }

            channel = (ChannelShell) jschSession.openChannel("shell");
            channel.setPtyType("xterm-256color");
            channel.setPtySize(80, 24, 640, 480);
            channel.connect(CONNECT_TIMEOUT_MS);

            log.info("SSH: usuário {} abriu console em {} ({}@{}:{})",
                    principalName(wsSession), host.getName(), host.getUsername(), host.getHost(), host.getPort());
            auditService.log(AuditModule.SSH_CONSOLE, "CONNECT", resolveUser(wsSession), "SSH_HOST", host.getId(), host.getName(),
                    host.getUsername() + "@" + host.getHost() + ":" + host.getPort());

            Bridge bridge = new Bridge(jschSession, channel);
            bridges.put(wsSession.getId(), bridge);
            bridge.startReader(wsSession);
        } catch (JSchException e) {
            log.warn("SSH: falha ao conectar em {} ({}): {}", host.getName(), host.getHost(), e.toString());
            if (channel != null) channel.disconnect();
            if (jschSession != null) jschSession.disconnect();
            closeQuietly(wsSession, 4007, "falha ao conectar via SSH");
        }
    }

    @Override
    protected void handleTextMessage(WebSocketSession wsSession, TextMessage message) throws Exception {
        Bridge bridge = bridges.get(wsSession.getId());
        if (bridge == null) return;

        JsonNode node = objectMapper.readTree(message.getPayload());
        String type = node.path("type").asText("");
        if ("input".equals(type)) {
            String data = node.path("data").asText("");
            OutputStream out = bridge.channel.getOutputStream();
            out.write(data.getBytes(StandardCharsets.UTF_8));
            out.flush();
        } else if ("resize".equals(type)) {
            int cols = node.path("cols").asInt(80);
            int rows = node.path("rows").asInt(24);
            bridge.channel.setPtySize(cols, rows, cols * 8, rows * 16);
        }
    }

    @Override
    public void afterConnectionClosed(WebSocketSession wsSession, CloseStatus status) {
        cleanup(wsSession.getId());
    }

    @Override
    public void handleTransportError(WebSocketSession wsSession, Throwable exception) {
        cleanup(wsSession.getId());
    }

    private void cleanup(String sessionId) {
        Bridge bridge = bridges.remove(sessionId);
        if (bridge != null) bridge.close();
    }

    private UUID extractHostId(WebSocketSession wsSession) {
        String path = wsSession.getUri().getPath();
        String idStr = path.substring(path.lastIndexOf('/') + 1);
        return UUID.fromString(idStr);
    }

    private void configureIdentity(JSch jsch, SshHost host) throws JSchException {
        if (host.getAuthType() != SshAuthType.PRIVATE_KEY) return;
        String privateKey = crypto.decrypt(host.getEncryptedPrivateKey());
        byte[] passphrase = null;
        if (host.getEncryptedPrivateKeyPassphrase() != null && !host.getEncryptedPrivateKeyPassphrase().isBlank()) {
            passphrase = crypto.decrypt(host.getEncryptedPrivateKeyPassphrase()).getBytes(StandardCharsets.UTF_8);
        }
        jsch.addIdentity(host.getId() != null ? host.getId().toString() : host.getHost(),
                privateKey.getBytes(StandardCharsets.UTF_8), null, passphrase);
    }

    private boolean isAdmin(WebSocketSession wsSession) {
        if (!(wsSession.getPrincipal() instanceof Authentication auth)) return false;
        for (GrantedAuthority a : auth.getAuthorities()) {
            if ("ROLE_ADMIN".equals(a.getAuthority())) return true;
        }
        return false;
    }

    private String principalName(WebSocketSession wsSession) {
        return wsSession.getPrincipal() != null ? wsSession.getPrincipal().getName() : "desconhecido";
    }

    private User resolveUser(WebSocketSession wsSession) {
        if (wsSession.getPrincipal() == null) return null;
        return userRepo.findByEmail(wsSession.getPrincipal().getName()).orElse(null);
    }

    private void closeQuietly(WebSocketSession wsSession, int code, String reason) {
        try { wsSession.close(new CloseStatus(code, reason)); } catch (Exception ignored) {}
    }

    private class Bridge {
        final Session jschSession;
        final ChannelShell channel;

        Bridge(Session jschSession, ChannelShell channel) {
            this.jschSession = jschSession;
            this.channel = channel;
        }

        void startReader(WebSocketSession wsSession) {
            Thread reader = new Thread(() -> {
                try (Reader in = new InputStreamReader(channel.getInputStream(), StandardCharsets.UTF_8)) {
                    char[] buf = new char[4096];
                    int n;
                    while ((n = in.read(buf)) != -1) {
                        if (!wsSession.isOpen()) break;
                        wsSession.sendMessage(new TextMessage(new String(buf, 0, n)));
                    }
                } catch (Exception e) {
                    log.debug("SSH: leitura encerrada para sessão {}: {}", wsSession.getId(), e.toString());
                } finally {
                    closeQuietly(wsSession, 1000, "sessao encerrada");
                    cleanup(wsSession.getId());
                }
            }, "ssh-ws-reader-" + wsSession.getId());
            reader.setDaemon(true);
            reader.start();
        }

        void close() {
            try { if (channel != null) channel.disconnect(); } catch (Exception ignored) {}
            try { if (jschSession != null) jschSession.disconnect(); } catch (Exception ignored) {}
        }
    }
}
