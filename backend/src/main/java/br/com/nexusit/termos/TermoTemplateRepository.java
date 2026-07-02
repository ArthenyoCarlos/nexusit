package br.com.nexusit.termos;

import org.springframework.data.jpa.repository.JpaRepository;
import java.util.*;

public interface TermoTemplateRepository extends JpaRepository<TermoTemplate, UUID> {
    Optional<TermoTemplate> findFirstByOrderByCreatedAtAsc();
}
