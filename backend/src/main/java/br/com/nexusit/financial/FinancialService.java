package br.com.nexusit.financial;

import br.com.nexusit.inventory.InventoryRepository;
import br.com.nexusit.licenses.LicenseRepository;
import br.com.nexusit.contracts.ContractRepository;
import br.com.nexusit.user.User;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;
import java.math.BigDecimal;
import java.time.LocalDate;
import java.util.List;
import java.util.Map;
import java.util.UUID;

@Service @RequiredArgsConstructor
public class FinancialService {
    private final BillRepository billRepo;
    private final InventoryRepository inventoryRepo;
    private final LicenseRepository licenseRepo;
    private final ContractRepository contractRepo;

    public List<BillResponse> findAll() { return billRepo.findAllByOrderByDueDateAsc().stream().map(BillResponse::from).toList(); }
    public List<BillResponse> findPending() { return billRepo.findByPaidFalseOrderByDueDateAsc().stream().map(BillResponse::from).toList(); }

    public BillResponse create(BillRequest req, User user) {
        Bill b = Bill.builder().title(req.title()).vendor(req.vendor())
                .category(req.category() != null ? req.category() : "Outros")
                .amount(req.amount()).dueDate(req.dueDate()).paid(false)
                .notes(req.notes()).createdBy(user).build();
        return BillResponse.from(billRepo.save(b));
    }

    public BillResponse markPaid(UUID id) {
        Bill b = billRepo.findById(id).orElseThrow();
        b.setPaid(true); b.setPaidAt(LocalDate.now());
        return BillResponse.from(billRepo.save(b));
    }

    public BillResponse update(UUID id, BillRequest req) {
        Bill b = billRepo.findById(id).orElseThrow();
        b.setTitle(req.title()); b.setVendor(req.vendor()); b.setCategory(req.category());
        b.setAmount(req.amount()); b.setDueDate(req.dueDate()); b.setNotes(req.notes());
        return BillResponse.from(billRepo.save(b));
    }

    public void delete(UUID id) { billRepo.deleteById(id); }

    public Map<String, Object> summary() {
        BigDecimal totalAssets = inventoryRepo.findAll().stream()
                .map(i -> i.getValue() != null ? i.getValue() : BigDecimal.ZERO)
                .reduce(BigDecimal.ZERO, BigDecimal::add);
        BigDecimal totalLicenses = licenseRepo.findAll().stream()
                .map(l -> l.getValue() != null ? l.getValue() : BigDecimal.ZERO)
                .reduce(BigDecimal.ZERO, BigDecimal::add);
        BigDecimal totalContracts = contractRepo.findAll().stream()
                .map(c -> c.getValue() != null ? c.getValue() : BigDecimal.ZERO)
                .reduce(BigDecimal.ZERO, BigDecimal::add);
        BigDecimal pendingBills = billRepo.sumPending();
        long overdueBills = billRepo.findByPaidFalseOrderByDueDateAsc().stream()
                .filter(b -> b.getDueDate().isBefore(LocalDate.now())).count();
        return Map.of(
                "totalAssets",    totalAssets,
                "totalLicenses",  totalLicenses,
                "totalContracts", totalContracts,
                "pendingBills",   pendingBills != null ? pendingBills : BigDecimal.ZERO,
                "overdueBills",   overdueBills,
                "totalBills",     billRepo.findByPaidFalseOrderByDueDateAsc().size()
        );
    }
}
