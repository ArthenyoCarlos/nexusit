package br.com.nexusit.support;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.core.io.ByteArrayResource;
import org.springframework.http.HttpEntity;
import org.springframework.http.HttpHeaders;
import org.springframework.http.HttpMethod;
import org.springframework.http.MediaType;
import org.springframework.http.ResponseEntity;
import org.springframework.stereotype.Service;
import org.springframework.util.LinkedMultiValueMap;
import org.springframework.util.MultiValueMap;
import org.springframework.web.client.RestTemplate;
import org.springframework.web.util.UriComponentsBuilder;

@Service
@Slf4j
public class AudioTranscriptionService {

    private static final String DEFAULT_OPENAI_URL = "https://api.openai.com/v1/audio/transcriptions";

    private final String apiKey;
    private final String apiUrl;
    private final String model;
    private final String language;
    private final RestTemplate restTemplate = new RestTemplate();
    private final ObjectMapper objectMapper = new ObjectMapper();

    public AudioTranscriptionService(
            @Value("${application.transcription.api-key:${OPENAI_API_KEY:}}") String apiKey,
            @Value("${application.transcription.api-url:${OPENAI_TRANSCRIPTION_API_URL:https://api.openai.com/v1/audio/transcriptions}}") String apiUrl,
            @Value("${application.transcription.model:${OPENAI_TRANSCRIPTION_MODEL:whisper-1}}") String model,
            @Value("${application.transcription.language:${OPENAI_TRANSCRIPTION_LANGUAGE:pt}}") String language) {
        this.apiKey = apiKey == null ? "" : apiKey.trim();
        this.apiUrl = apiUrl == null ? DEFAULT_OPENAI_URL : apiUrl.trim();
        this.model = model == null || model.isBlank() ? "whisper-1" : model.trim();
        this.language = language == null || language.isBlank() ? "pt" : language.trim();
    }

    public String transcribe(byte[] bytes, String filename, String mime) {
        if (bytes == null || bytes.length == 0) return "";
        boolean localAsr = apiUrl.contains("/asr") || apiUrl.contains("whisper:9000");
        if (!localAsr && apiKey.isBlank()) {
            log.info("Áudio recebido, mas transcrição não configurada (defina OPENAI_API_KEY ou application.transcription.api-key)");
            return "";
        }
        try {
            String safeFilename = filename == null || filename.isBlank() ? "audio.ogg" : filename;
            ByteArrayResource fileResource = new ByteArrayResource(bytes) {
                @Override public String getFilename() { return safeFilename; }
            };

            HttpHeaders fileHeaders = new HttpHeaders();
            fileHeaders.setContentType(MediaType.parseMediaType(mime == null || mime.isBlank() ? "application/octet-stream" : mime));

            MultiValueMap<String, Object> parts = new LinkedMultiValueMap<>();
            HttpHeaders headers = new HttpHeaders();
            headers.setContentType(MediaType.MULTIPART_FORM_DATA);

            String targetUrl = apiUrl;
            if (localAsr) {
                parts.add("audio_file", new HttpEntity<>(fileResource, fileHeaders));
                targetUrl = UriComponentsBuilder.fromHttpUrl(apiUrl)
                        .replaceQueryParam("task", "transcribe")
                        .replaceQueryParam("language", language)
                        .replaceQueryParam("output", "json")
                        .build(true)
                        .toUriString();
            } else {
                parts.add("model", model);
                parts.add("language", language);
                parts.add("response_format", "json");
                parts.add("file", new HttpEntity<>(fileResource, fileHeaders));
                headers.setBearerAuth(apiKey);
            }

            ResponseEntity<String> resp = restTemplate.exchange(
                    targetUrl, HttpMethod.POST, new HttpEntity<>(parts, headers), String.class);
            JsonNode root = objectMapper.readTree(resp.getBody());
            return root.path("text").asText("").trim();
        } catch (Exception e) {
            log.warn("Falha ao transcrever áudio '{}': {}", filename, e.getMessage());
            return "";
        }
    }
}
