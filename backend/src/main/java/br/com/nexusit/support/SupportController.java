package br.com.nexusit.support;

import br.com.nexusit.user.User;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import org.springframework.http.ContentDisposition;
import org.springframework.http.HttpHeaders;
import org.springframework.http.MediaType;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.*;
import org.springframework.web.multipart.MultipartFile;

import java.nio.charset.StandardCharsets;
import java.util.List;
import java.util.UUID;

@RestController
@RequestMapping("/api/support")
@RequiredArgsConstructor
public class SupportController {

    private final SupportService service;

    @GetMapping("/queue")
    public List<SupportConversationSummary> getQueue() { return service.getQueue(); }

    @GetMapping("/mine")
    public List<SupportConversationSummary> getMine(@AuthenticationPrincipal User user) { return service.getMine(user); }

    @GetMapping("/all")
    @PreAuthorize("hasRole('ADMIN')")
    public List<SupportConversationSummary> getAll(@RequestParam(defaultValue = "30") int days) {
        return service.getAll(days);
    }

    @GetMapping("/{id}")
    public SupportConversationDetail getDetail(@PathVariable UUID id) { return service.getDetail(id); }

    @GetMapping("/messages/{messageId}/media")
    public ResponseEntity<byte[]> getMessageMedia(@PathVariable UUID messageId) {
        SupportMessageMedia media = service.getMessageMedia(messageId);
        String mime = media.mime() == null || media.mime().isBlank() ? "application/octet-stream" : media.mime();
        String filename = media.filename() == null || media.filename().isBlank() ? "anexo" : media.filename();
        return ResponseEntity.ok()
                .contentType(MediaType.parseMediaType(mime))
                .header(HttpHeaders.CONTENT_DISPOSITION, ContentDisposition.inline()
                        .filename(filename, StandardCharsets.UTF_8)
                        .build().toString())
                .body(media.bytes());
    }

    @PostMapping("/{id}/claim")
    public SupportConversationDetail claim(@PathVariable UUID id, @AuthenticationPrincipal User user) {
        return service.claim(id, user);
    }

    @PostMapping("/{id}/technicians")
    public SupportConversationDetail addTechnician(@PathVariable UUID id, @Valid @RequestBody TechnicianRequest req,
                                                     @AuthenticationPrincipal User user) {
        return service.addTechnician(id, user, req.userId());
    }

    @DeleteMapping("/{id}/technicians/{technicianId}")
    public SupportConversationDetail removeTechnician(@PathVariable UUID id, @PathVariable UUID technicianId,
                                                        @AuthenticationPrincipal User user) {
        return service.removeTechnician(id, user, technicianId);
    }

    @PostMapping("/{id}/transfer")
    public SupportConversationDetail transfer(@PathVariable UUID id, @Valid @RequestBody TechnicianRequest req,
                                                @AuthenticationPrincipal User user) {
        return service.transfer(id, user, req.userId());
    }

    @PostMapping(value = "/{id}/reply", consumes = MediaType.APPLICATION_JSON_VALUE)
    public SupportConversationDetail reply(@PathVariable UUID id, @Valid @RequestBody ReplyRequest req,
                                            @AuthenticationPrincipal User user) {
        return service.reply(id, user, req.message());
    }

    @PostMapping(value = "/{id}/reply", consumes = MediaType.MULTIPART_FORM_DATA_VALUE)
    public SupportConversationDetail replyWithAttachment(@PathVariable UUID id,
                                                         @RequestPart(value = "message", required = false) String message,
                                                         @RequestPart(value = "file", required = false) MultipartFile file,
                                                         @AuthenticationPrincipal User user) {
        return service.reply(id, user, message, file);
    }

    @PostMapping("/{id}/close")
    public SupportConversationDetail close(@PathVariable UUID id) { return service.close(id); }
}
