package br.com.nexusit.sshconsole;

import org.springframework.data.jpa.repository.JpaRepository;

import java.util.UUID;

public interface SshHostRepository extends JpaRepository<SshHost, UUID> {
}
