package br.com.nexusit.push;

import com.google.auth.oauth2.GoogleCredentials;
import com.google.firebase.FirebaseApp;
import com.google.firebase.FirebaseOptions;
import com.google.firebase.messaging.FirebaseMessaging;
import com.google.firebase.messaging.FirebaseMessagingException;
import com.google.firebase.messaging.Message;
import com.google.firebase.messaging.MessagingErrorCode;
import com.google.firebase.messaging.Notification;
import jakarta.annotation.PostConstruct;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Service;

import java.io.FileInputStream;
import java.io.IOException;
import java.util.List;
import java.util.Map;
import java.util.UUID;

/**
 * Envia push notification real (Firebase Cloud Messaging) para o app Android do
 * CRM de Suporte. Se FIREBASE_CREDENTIALS_PATH não estiver configurado (ambiente
 * de dev sem Firebase), fica silenciosamente desativado em vez de derrubar o boot.
 */
@Service
@RequiredArgsConstructor
@Slf4j
public class PushNotificationService {

    private final FirebaseProperties properties;
    private final DeviceTokenRepository deviceTokenRepo;
    private FirebaseMessaging messaging;

    @PostConstruct
    void init() {
        String path = properties.getCredentialsPath();
        if (path == null || path.isBlank()) {
            log.warn("FIREBASE_CREDENTIALS_PATH não configurado — push notification desativado.");
            return;
        }
        try (FileInputStream serviceAccount = new FileInputStream(path)) {
            FirebaseOptions options = FirebaseOptions.builder()
                    .setCredentials(GoogleCredentials.fromStream(serviceAccount))
                    .build();
            FirebaseApp app = FirebaseApp.getApps().isEmpty()
                    ? FirebaseApp.initializeApp(options)
                    : FirebaseApp.getInstance();
            this.messaging = FirebaseMessaging.getInstance(app);
            log.info("Firebase Admin SDK inicializado — push notification ativo.");
        } catch (IOException e) {
            log.warn("Falha ao inicializar Firebase Admin SDK ({}); push notification desativado.", e.getMessage());
        }
    }

    public void sendToUser(UUID userId, String title, String body, Map<String, String> data) {
        if (messaging == null || userId == null) return;
        List<DeviceToken> tokens = deviceTokenRepo.findByUserId(userId);
        for (DeviceToken deviceToken : tokens) {
            send(deviceToken, title, body, data);
        }
    }

    private void send(DeviceToken deviceToken, String title, String body, Map<String, String> data) {
        try {
            Message.Builder builder = Message.builder()
                    .setToken(deviceToken.getToken())
                    .setNotification(Notification.builder().setTitle(title).setBody(body).build());
            if (data != null) builder.putAllData(data);
            messaging.send(builder.build());
        } catch (FirebaseMessagingException e) {
            if (e.getMessagingErrorCode() == MessagingErrorCode.UNREGISTERED
                    || e.getMessagingErrorCode() == MessagingErrorCode.INVALID_ARGUMENT) {
                log.info("Token de dispositivo inválido/expirado, removendo: {}", deviceToken.getId());
                deviceTokenRepo.delete(deviceToken);
            } else {
                log.warn("Falha ao enviar push para dispositivo {}: {}", deviceToken.getId(), e.getMessage());
            }
        }
    }
}
