package br.com.nexusit.meetings;

import br.com.nexusit.user.User;
import jakarta.persistence.EntityNotFoundException;
import lombok.RequiredArgsConstructor;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.server.ResponseStatusException;

import java.util.List;
import java.util.UUID;

@Service
@RequiredArgsConstructor
@Transactional(readOnly = true)
public class MeetingService {

    private final MeetingRepository repository;

    public List<MeetingResponse> findAll() {
        return repository.findAllWithRelations()
                .stream().map(MeetingResponse::from).toList();
    }

    @Transactional
    public MeetingResponse create(MeetingRequest req, User currentUser) {
        Meeting meeting = Meeting.builder()
                .title(req.title())
                .type(req.type() != null ? req.type() : MeetingType.EQUIPE)
                .companyName(req.companyName())
                .meetingDate(req.meetingDate())
                .participants(req.participants())
                .summary(req.summary())
                .nextSteps(req.nextSteps())
                .createdBy(currentUser)
                .build();

        return MeetingResponse.from(repository.save(meeting));
    }

    @Transactional
    public MeetingResponse update(UUID id, MeetingRequest req, User currentUser) {
        Meeting meeting = repository.findById(id)
                .orElseThrow(() -> new EntityNotFoundException("Reunião não encontrada: " + id));

        if (!isAuthorOrAdmin(meeting, currentUser)) {
            throw new ResponseStatusException(HttpStatus.FORBIDDEN, "Apenas quem registrou pode editar esta reunião");
        }

        meeting.setTitle(req.title());
        if (req.type() != null) meeting.setType(req.type());
        meeting.setCompanyName(req.companyName());
        meeting.setMeetingDate(req.meetingDate());
        meeting.setParticipants(req.participants());
        meeting.setSummary(req.summary());
        meeting.setNextSteps(req.nextSteps());

        return MeetingResponse.from(repository.save(meeting));
    }

    @Transactional
    public void delete(UUID id, User currentUser) {
        Meeting meeting = repository.findById(id)
                .orElseThrow(() -> new EntityNotFoundException("Reunião não encontrada: " + id));

        if (!isAuthorOrAdmin(meeting, currentUser)) {
            throw new ResponseStatusException(HttpStatus.FORBIDDEN, "Sem permissão para excluir esta reunião");
        }

        repository.delete(meeting);
    }

    private boolean isAuthorOrAdmin(Meeting meeting, User currentUser) {
        boolean isAdmin = currentUser.getAuthorities().stream()
                .anyMatch(a -> a.getAuthority().equals("ROLE_ADMIN"));
        boolean isAuthor = meeting.getCreatedBy() != null && meeting.getCreatedBy().getId().equals(currentUser.getId());
        return isAuthor || isAdmin;
    }
}
