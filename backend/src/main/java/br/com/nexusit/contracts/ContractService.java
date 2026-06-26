package br.com.nexusit.contracts;

import br.com.nexusit.user.User;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;
import java.util.List;
import java.util.UUID;

@Service @RequiredArgsConstructor
public class ContractService {
    private final ContractRepository repo;

    public List<ContractResponse> findAll() {
        return repo.findAllByOrderByEndDateAsc().stream().map(ContractResponse::from).toList();
    }

    public ContractResponse create(ContractRequest req, User user) {
        Contract c = Contract.builder()
                .name(req.name()).vendor(req.vendor()).contactName(req.contactName())
                .contactEmail(req.contactEmail()).contactPhone(req.contactPhone())
                .type(req.type() != null ? req.type() : "ANUAL").value(req.value())
                .startDate(req.startDate()).endDate(req.endDate())
                .autoRenew(req.autoRenew()).notes(req.notes()).createdBy(user).build();
        return ContractResponse.from(repo.save(c));
    }

    public ContractResponse update(UUID id, ContractRequest req) {
        Contract c = repo.findById(id).orElseThrow();
        c.setName(req.name()); c.setVendor(req.vendor()); c.setContactName(req.contactName());
        c.setContactEmail(req.contactEmail()); c.setContactPhone(req.contactPhone());
        c.setType(req.type() != null ? req.type() : c.getType()); c.setValue(req.value());
        c.setStartDate(req.startDate()); c.setEndDate(req.endDate());
        c.setAutoRenew(req.autoRenew()); c.setNotes(req.notes());
        return ContractResponse.from(repo.save(c));
    }

    public void delete(UUID id) { repo.deleteById(id); }
}
