package br.com.nexusit.sshconsole;

import br.com.nexusit.inventory.InventoryRepository;
import br.com.nexusit.user.User;
import br.com.nexusit.vault.CryptoService;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.ArgumentCaptor;
import org.mockito.InjectMocks;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

@ExtendWith(MockitoExtension.class)
class SshHostServiceTest {

    @Mock
    SshHostRepository repo;

    @Mock
    InventoryRepository inventoryRepo;

    @Mock
    CryptoService crypto;

    @InjectMocks
    SshHostService service;

    @Test
    void createAllowsPrivateKeyAuthenticationWithoutPassword() {
        String privateKey = "-----BEGIN OPENSSH PRIVATE KEY-----\nabc\n-----END OPENSSH PRIVATE KEY-----";
        when(crypto.encrypt(privateKey)).thenReturn("encrypted-key");
        when(repo.save(any(SshHost.class))).thenAnswer(inv -> inv.getArgument(0));

        SshHostRequest req = new SshHostRequest(
                "Servidor Interno NexusIT",
                "192.168.2.210",
                22,
                "galdino",
                "PRIVATE_KEY",
                null,
                privateKey,
                null,
                "Acesso por chave ao próprio servidor interno",
                null
        );

        SshHostResponse response = service.create(req, User.builder().name("Admin").build());

        ArgumentCaptor<SshHost> captor = ArgumentCaptor.forClass(SshHost.class);
        verify(repo).save(captor.capture());
        SshHost saved = captor.getValue();
        assertThat(saved.getAuthType()).isEqualTo(SshAuthType.PRIVATE_KEY);
        assertThat(saved.getEncryptedPassword()).isNull();
        assertThat(saved.getEncryptedPrivateKey()).isEqualTo("encrypted-key");
        assertThat(response.authType()).isEqualTo(SshAuthType.PRIVATE_KEY);
        assertThat(response.hasCredential()).isTrue();
    }
}
