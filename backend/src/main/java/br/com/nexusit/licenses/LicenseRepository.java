package br.com.nexusit.licenses;

import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

import java.time.LocalDate;
import java.util.List;
import java.util.UUID;

public interface LicenseRepository extends JpaRepository<License, UUID> {

    @Query("SELECT l FROM License l ORDER BY l.expiryDate ASC NULLS LAST, l.name ASC")
    List<License> findAllOrdered();

    @Query("SELECT l FROM License l WHERE l.expiryDate BETWEEN :from AND :to ORDER BY l.expiryDate ASC")
    List<License> findExpiringBetween(@Param("from") LocalDate from, @Param("to") LocalDate to);
}
