package br.com.nexusit.meetings;

import java.time.LocalDate;
import java.time.LocalDateTime;
import java.util.UUID;

public record MeetingResponse(
        UUID id,
        String title,
        String type,
        String companyName,
        LocalDate meetingDate,
        String participants,
        String summary,
        String nextSteps,
        UUID createdById,
        String createdByName,
        LocalDateTime createdAt,
        LocalDateTime updatedAt
) {
    public static MeetingResponse from(Meeting meeting) {
        return new MeetingResponse(
                meeting.getId(),
                meeting.getTitle(),
                meeting.getType().name(),
                meeting.getCompanyName(),
                meeting.getMeetingDate(),
                meeting.getParticipants(),
                meeting.getSummary(),
                meeting.getNextSteps(),
                meeting.getCreatedBy() != null ? meeting.getCreatedBy().getId() : null,
                meeting.getCreatedBy() != null ? meeting.getCreatedBy().getName() : null,
                meeting.getCreatedAt(),
                meeting.getUpdatedAt()
        );
    }
}
