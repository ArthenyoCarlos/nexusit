package br.com.nexusit.notes;

import jakarta.validation.constraints.NotBlank;

import java.util.List;

public record NoteRequest(
        @NotBlank String title,
        String content,
        NoteVisibility visibility,
        List<TagRequest> tags
) {
    public record TagRequest(String tag, String category) {}
}
