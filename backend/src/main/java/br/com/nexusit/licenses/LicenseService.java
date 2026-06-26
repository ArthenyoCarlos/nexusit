package br.com.nexusit.licenses;

import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.List;
import java.util.UUID;

@Service
@RequiredArgsConstructor
@Transactional(readOnly = true)
public class LicenseService {

    private final LicenseRepository repository;

    public List<LicenseResponse> findAll() {
        return repository.findAllOrdered().stream().map(LicenseResponse::from).toList();
    }

    public LicenseResponse findById(UUID id) {
        return repository.findById(id)
                .map(LicenseResponse::from)
                .orElseThrow(() -> new jakarta.persistence.EntityNotFoundException("Licença não encontrada"));
    }

    @Transactional
    public LicenseResponse create(LicenseRequest req) {
        License l = License.builder()
                .name(req.name()).vendor(req.vendor()).product(req.product())
                .licenseKey(req.licenseKey())
                .seatsTotal(req.seatsTotal())
                .seatsUsed(req.seatsUsed() != null ? req.seatsUsed() : 0)
                .purchaseDate(req.purchaseDate()).expiryDate(req.expiryDate())
                .value(req.value()).notes(req.notes())
                .build();
        return LicenseResponse.from(repository.save(l));
    }

    @Transactional
    public LicenseResponse update(UUID id, LicenseRequest req) {
        License l = repository.findById(id)
                .orElseThrow(() -> new jakarta.persistence.EntityNotFoundException("Licença não encontrada"));
        l.setName(req.name()); l.setVendor(req.vendor()); l.setProduct(req.product());
        l.setLicenseKey(req.licenseKey());
        if (req.seatsTotal() != null) l.setSeatsTotal(req.seatsTotal());
        if (req.seatsUsed() != null)  l.setSeatsUsed(req.seatsUsed());
        l.setPurchaseDate(req.purchaseDate()); l.setExpiryDate(req.expiryDate());
        l.setValue(req.value()); l.setNotes(req.notes());
        return LicenseResponse.from(repository.save(l));
    }

    @Transactional
    public void delete(UUID id) {
        if (!repository.existsById(id))
            throw new jakarta.persistence.EntityNotFoundException("Licença não encontrada");
        repository.deleteById(id);
    }
}
