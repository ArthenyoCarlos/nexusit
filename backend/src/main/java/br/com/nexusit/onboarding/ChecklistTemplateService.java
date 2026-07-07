package br.com.nexusit.onboarding;

import jakarta.persistence.EntityNotFoundException;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.ArrayList;
import java.util.List;
import java.util.UUID;

@Service
@RequiredArgsConstructor
@Transactional(readOnly = true)
public class ChecklistTemplateService {

    private final ChecklistTemplateRepository templateRepo;

    public List<ChecklistTemplateResponse> findAll(String type) {
        return templateRepo.findByType(type != null && !type.isBlank() ? type : null)
                .stream().map(ChecklistTemplateResponse::from).toList();
    }

    public List<ChecklistTemplateResponse> findActive(String type) {
        return templateRepo.findActiveByType(type)
                .stream().map(ChecklistTemplateResponse::from).toList();
    }

    public ChecklistTemplateResponse findById(UUID id) {
        ChecklistTemplate t = templateRepo.findByIdWithItems(id)
                .orElseThrow(() -> new EntityNotFoundException("Template não encontrado"));
        return ChecklistTemplateResponse.from(t);
    }

    @Transactional
    public ChecklistTemplateResponse create(ChecklistTemplateRequest req) {
        ChecklistTemplate template = ChecklistTemplate.builder()
                .type(req.type())
                .name(req.name())
                .active(req.active() == null || req.active())
                .build();
        template.setItems(buildItems(template, req.items()));
        return ChecklistTemplateResponse.from(templateRepo.save(template));
    }

    @Transactional
    public ChecklistTemplateResponse update(UUID id, ChecklistTemplateRequest req) {
        ChecklistTemplate template = templateRepo.findByIdWithItems(id)
                .orElseThrow(() -> new EntityNotFoundException("Template não encontrado"));
        template.setType(req.type());
        template.setName(req.name());
        if (req.active() != null) template.setActive(req.active());
        template.getItems().clear();
        template.getItems().addAll(buildItems(template, req.items()));
        return ChecklistTemplateResponse.from(templateRepo.save(template));
    }

    @Transactional
    public void delete(UUID id) {
        if (!templateRepo.existsById(id))
            throw new EntityNotFoundException("Template não encontrado");
        templateRepo.deleteById(id);
    }

    private List<ChecklistTemplateItem> buildItems(ChecklistTemplate template, List<ChecklistTemplateRequest.ItemRequest> reqItems) {
        List<ChecklistTemplateItem> items = new ArrayList<>();
        if (reqItems == null) return items;
        int order = 0;
        for (ChecklistTemplateRequest.ItemRequest ir : reqItems) {
            items.add(ChecklistTemplateItem.builder()
                    .template(template)
                    .title(ir.title())
                    .description(ir.description())
                    .itemOrder(ir.itemOrder() != null ? ir.itemOrder() : order++)
                    .build());
        }
        return items;
    }
}
