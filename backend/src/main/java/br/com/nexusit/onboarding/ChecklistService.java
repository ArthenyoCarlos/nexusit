package br.com.nexusit.onboarding;

import br.com.nexusit.inventory.InventoryItem;
import br.com.nexusit.inventory.InventoryRepository;
import br.com.nexusit.user.User;
import br.com.nexusit.user.UserRepository;
import jakarta.persistence.EntityNotFoundException;
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
    private final ChecklistTemplateRepository templateRepo;
    private final UserRepository userRepo;
    private final InventoryRepository inventoryRepo;

    public List<ChecklistResponse> findAll(String type, String status) {
        ChecklistStatus statusEnum = (status != null && !status.isBlank()) ? ChecklistStatus.valueOf(status) : null;
        return checklistRepo.findByTypeAndStatus(type != null && !type.isBlank() ? type : null, statusEnum)
                .stream().map(ChecklistResponse::from).toList();
    }

    public ChecklistResponse findById(UUID id) {
        Checklist c = checklistRepo.findByIdWithItems(id)
                .orElseThrow(() -> new EntityNotFoundException("Checklist não encontrado"));
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
                .status(ChecklistStatus.IN_PROGRESS)
                .employeeUser(resolveUser(req.employeeUserId()))
                .inventoryItem(resolveInventoryItem(req.inventoryItemId()))
                .createdBy(currentUser)
                .build();

        List<ChecklistRequest.ItemRequest> sourceItems;
        if (req.templateId() != null) {
            ChecklistTemplate template = templateRepo.findByIdWithItems(req.templateId())
                    .orElseThrow(() -> new EntityNotFoundException("Template não encontrado"));
            sourceItems = template.getItems().stream()
                    .map(i -> new ChecklistRequest.ItemRequest(i.getTitle(), i.getDescription(), i.getItemOrder(), null, null))
                    .toList();
        } else {
            sourceItems = req.items() != null ? req.items() : List.of();
        }

        List<ChecklistItem> items = new ArrayList<>();
        int order = 0;
        for (ChecklistRequest.ItemRequest ir : sourceItems) {
            ChecklistItem item = ChecklistItem.builder()
                    .checklist(checklist)
                    .title(ir.title())
                    .description(ir.description())
                    .itemOrder(ir.itemOrder() != null ? ir.itemOrder() : order++)
                    .dueDate(ir.dueDate())
                    .assignedTo(resolveUser(ir.assignedToId()))
                    .done(false)
                    .build();
            items.add(item);
        }
        checklist.setItems(items);
        return ChecklistResponse.from(checklistRepo.save(checklist));
    }

    @Transactional
    public ChecklistResponse update(UUID id, ChecklistUpdateRequest req) {
        Checklist checklist = checklistRepo.findById(id)
                .orElseThrow(() -> new EntityNotFoundException("Checklist não encontrado"));

        if (req.employeeName() != null && !req.employeeName().isBlank()) checklist.setEmployeeName(req.employeeName().trim());
        if (req.department() != null) checklist.setDepartment(req.department());
        if (req.startDate() != null) checklist.setStartDate(req.startDate());
        if (req.notes() != null) checklist.setNotes(req.notes());
        if (req.employeeUserId() != null) checklist.setEmployeeUser(resolveUser(req.employeeUserId()));
        if (req.inventoryItemId() != null) checklist.setInventoryItem(resolveInventoryItem(req.inventoryItemId()));

        if (req.status() != null && !req.status().isBlank()) {
            ChecklistStatus newStatus = ChecklistStatus.valueOf(req.status());
            applyStatus(checklist, newStatus);
        }

        return ChecklistResponse.from(checklistRepo.save(checklist));
    }

    @Transactional
    public ChecklistResponse toggleItem(UUID checklistId, UUID itemId, User currentUser) {
        ChecklistItem item = itemRepo.findById(itemId)
                .orElseThrow(() -> new EntityNotFoundException("Item não encontrado"));
        boolean newDone = !Boolean.TRUE.equals(item.getDone());
        item.setDone(newDone);
        item.setDoneAt(newDone ? LocalDateTime.now() : null);
        item.setDoneBy(newDone ? currentUser : null);
        itemRepo.save(item);

        Checklist checklist = checklistRepo.findByIdWithItems(checklistId)
                .orElseThrow(() -> new EntityNotFoundException("Checklist não encontrado"));
        boolean allDone = !checklist.getItems().isEmpty() &&
                checklist.getItems().stream().allMatch(i -> Boolean.TRUE.equals(i.getDone()));
        if (allDone && checklist.getStatus() == ChecklistStatus.IN_PROGRESS) {
            applyStatus(checklist, ChecklistStatus.COMPLETED);
            checklistRepo.save(checklist);
        } else if (!allDone && checklist.getStatus() == ChecklistStatus.COMPLETED) {
            applyStatus(checklist, ChecklistStatus.IN_PROGRESS);
            checklistRepo.save(checklist);
        }
        return findById(checklistId);
    }

    @Transactional
    public ChecklistResponse addItem(UUID checklistId, ChecklistRequest.ItemRequest req) {
        Checklist checklist = checklistRepo.findByIdWithItems(checklistId)
                .orElseThrow(() -> new EntityNotFoundException("Checklist não encontrado"));
        int nextOrder = checklist.getItems().stream()
                .map(ChecklistItem::getItemOrder).filter(o -> o != null)
                .max(Integer::compareTo).orElse(-1) + 1;
        ChecklistItem item = ChecklistItem.builder()
                .checklist(checklist)
                .title(req.title())
                .description(req.description())
                .itemOrder(req.itemOrder() != null ? req.itemOrder() : nextOrder)
                .dueDate(req.dueDate())
                .assignedTo(resolveUser(req.assignedToId()))
                .done(false)
                .build();
        checklist.getItems().add(item);
        if (checklist.getStatus() == ChecklistStatus.COMPLETED) applyStatus(checklist, ChecklistStatus.IN_PROGRESS);
        checklistRepo.save(checklist);
        return findById(checklistId);
    }

    @Transactional
    public ChecklistResponse updateItem(UUID checklistId, UUID itemId, ChecklistItemUpdateRequest req) {
        ChecklistItem item = itemRepo.findById(itemId)
                .orElseThrow(() -> new EntityNotFoundException("Item não encontrado"));
        if (req.title() != null && !req.title().isBlank()) item.setTitle(req.title().trim());
        if (req.description() != null) item.setDescription(req.description());
        item.setDueDate(req.dueDate());
        item.setAssignedTo(resolveUser(req.assignedToId()));
        itemRepo.save(item);
        return findById(checklistId);
    }

    @Transactional
    public ChecklistResponse removeItem(UUID checklistId, UUID itemId) {
        Checklist checklist = checklistRepo.findByIdWithItems(checklistId)
                .orElseThrow(() -> new EntityNotFoundException("Checklist não encontrado"));
        checklist.getItems().removeIf(i -> i.getId().equals(itemId));
        checklistRepo.save(checklist);
        return findById(checklistId);
    }

    @Transactional
    public void delete(UUID id) {
        if (!checklistRepo.existsById(id))
            throw new EntityNotFoundException("Checklist não encontrado");
        checklistRepo.deleteById(id);
    }

    private void applyStatus(Checklist checklist, ChecklistStatus newStatus) {
        checklist.setStatus(newStatus);
        checklist.setCompletedAt(newStatus == ChecklistStatus.COMPLETED ? LocalDateTime.now() : null);
    }

    private User resolveUser(UUID id) {
        if (id == null) return null;
        return userRepo.findById(id).orElseThrow(() -> new EntityNotFoundException("Usuário não encontrado"));
    }

    private InventoryItem resolveInventoryItem(UUID id) {
        if (id == null) return null;
        return inventoryRepo.findById(id).orElseThrow(() -> new EntityNotFoundException("Item de inventário não encontrado"));
    }
}
