package br.com.nexusit.termos;

import org.springframework.data.jpa.repository.JpaRepository;
import java.util.*;

public interface TermoRepository extends JpaRepository<TermoResponsabilidade, UUID> {
    Optional<TermoResponsabilidade> findTopByNumeroTermoStartingWithOrderByNumeroTermoDesc(String prefix);
    Optional<TermoResponsabilidade> findTopByTombamentoStartingWithOrderByTombamentoDesc(String prefix);
}
