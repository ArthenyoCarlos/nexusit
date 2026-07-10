package br.com.nexusit.meetings;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;

import java.time.LocalDate;

public record MeetingRequest(
        @NotBlank String title,
        MeetingType type,
        String companyName,
        @NotNull LocalDate meetingDate,
        String participants,
        String summary,
        String nextSteps
) {
}
