package br.com.nexusit.financial;

import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import java.util.List;
import java.util.UUID;

public interface BillRepository extends JpaRepository<Bill, UUID> {
    List<Bill> findAllByOrderByDueDateAsc();
    List<Bill> findByPaidFalseOrderByDueDateAsc();

    @Query("SELECT COALESCE(SUM(b.amount),0) FROM Bill b WHERE b.paid = false")
    java.math.BigDecimal sumPending();
}
