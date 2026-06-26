package br.com.nexusit.onboarding;

import br.com.nexusit.user.User;
import br.com.nexusit.user.UserRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.LocalDateTime;
import java.util.ArrayList;
import java.util.List;
import java.util.UUID;

@Service
@RequiredArgsConstructor
@Transactional(readOnly = true)
public class ChecklistService {

    private final ChecklistRepository checklistRepo;
    private final ChecklistItemRepository itemRepo;
    private final UserRepository userRepo;

    public List<ChecklistResponse> findAll(String type) {
        return checklistRepo.findByType(type != null && !type.isBlank() ? type : null)
                .stream().map(ChecklistResponse::from).toList();
    }

    public ChecklistResponse findById(UUID id) {
        Checklist c = checklistRepo.findByIdWithItems(id)
                .orElseThrow(() -> new jakarta.persistence.EntityNotFoundException("Checklist não encontrado"));
        return ChecklistResponse.from(c);
    }

    @Transactional
    public ChecklistResponse create(ChecklistRequest req, User currentUser) {
        Checklist checklist = Checklist.builder()
                .type(req.type())
                .employeeName(req.employeeName())
                .department(req.department())
                .startDate(req.startDate())
                .notes(req.notes())
                .createdBy(currentUser)
                .build();

        List<ChecklistItem> items = new ArrayList<>();
        int order = 0;
        for (ChecklistRequest.ItemRequest ir : req.items()) {
            ChecklistItem item = ChecklistItem.builder()
                    .checklist(checklist)
                    .title(ir.title())
                    .description(ir.description())
                    .itemOrder(ir.itemOrder() != null ? ir.itemOrder() : order++)
                    .done(false)
                    .build();
            items.add(item);
        }
        checklist.setItems(items);
        return ChecklistResponse.from(checklistRepo.save(checklist));
    }

    @Transactional
    public ChecklistResponse toggleItem(UUID checklistId, UUID itemId, User currentUser) {
        ChecklistItem item = itemRepo.findById(itemId)
                .orElseThrow(() -> new jakarta.persistence.EntityNotFoundException("Item não encontrado"));
        boolean newDone = !Boolean.TRUE.equals(item.getDone());
        item.setDone(newDone);
        item.setDoneAt(newDone ? LocalDateTime.now() : null);
        item.setDoneBy(newDone ? currentUser : null);
        itemRepo.save(item);
        return findById(checklistId);
    }

    @Transactional
    public void delete(UUID id) {
        if (!checklistRepo.existsById(id))
            throw new jakarta.persistence.EntityNotFoundException("Checklist não encontrado");
        checklistRepo.deleteById(id);
    }
}
