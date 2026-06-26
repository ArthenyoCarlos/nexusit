package br.com.nexusit.contracts;

import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import java.time.LocalDate;
import java.util.List;
import java.util.UUID;

public interface ContractRepository extends JpaRepository<Contract, UUID> {
    List<Contract> findAllByOrderByEndDateAsc();

    @Query("SELECT c FROM Contract c WHERE c.endDate BETWEEN :from AND :to")
    List<Contract> findExpiringBetween(@Param("from") LocalDate from, @Param("to") LocalDate to);
}
