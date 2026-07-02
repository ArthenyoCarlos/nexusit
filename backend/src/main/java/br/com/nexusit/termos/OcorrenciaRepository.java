package br.com.nexusit.termos;

import org.springframework.data.jpa.repository.JpaRepository;
import java.util.UUID;

public interface OcorrenciaRepository extends JpaRepository<OcorrenciaTermo, UUID> {}
