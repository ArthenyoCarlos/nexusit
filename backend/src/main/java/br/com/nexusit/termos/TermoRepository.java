package br.com.nexusit.termos;

import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import java.util.*;

public interface TermoRepository extends JpaRepository<TermoResponsabilidade, UUID> {
    @Query(value = "select coalesce(max(cast(substring(numero_termo from '[0-9]+$') as integer)), 0) from termos_responsabilidade where numero_termo like concat(:prefix, '%')", nativeQuery = true)
    Integer maxNumeroTermoSeq(@Param("prefix") String prefix);

    @Query(value = "select coalesce(max(cast(substring(tombamento from '[0-9]+$') as integer)), 0) from termos_responsabilidade where tombamento like concat(:prefix, '%')", nativeQuery = true)
    Integer maxTombamentoSeq(@Param("prefix") String prefix);
}
