package br.com.nexusit.user;

import br.com.nexusit.TestSecurityConfig;
import com.fasterxml.jackson.databind.ObjectMapper;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.autoconfigure.web.servlet.WebMvcTest;
import org.springframework.boot.test.mock.mockito.MockBean;
import org.springframework.context.annotation.Import;
import org.springframework.http.MediaType;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.test.web.servlet.MockMvc;

import java.util.List;
import java.util.Optional;
import java.util.UUID;

import static org.mockito.ArgumentMatchers.any;
import static org.mockito.BDDMockito.given;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.*;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.*;

@WebMvcTest(UserController.class)
@Import(TestSecurityConfig.class)
class UserControllerTest {

    @Autowired MockMvc mockMvc;
    @Autowired ObjectMapper objectMapper;
    @MockBean UserRepository userRepository;
    @MockBean PasswordEncoder passwordEncoder;

    @Test
    void listAll_returnsUserList() throws Exception {
        User user = User.builder()
                .id(UUID.randomUUID()).name("Admin").email("admin@nexusit.com")
                .passwordHash("hash").role(Role.ADMIN).active(true).build();
        given(userRepository.findAll()).willReturn(List.of(user));

        mockMvc.perform(get("/api/users"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$[0].name").value("Admin"))
                .andExpect(jsonPath("$[0].email").value("admin@nexusit.com"));
    }

    @Test
    void create_validRequest_returnsCreated() throws Exception {
        UserController.CreateUserRequest req = new UserController.CreateUserRequest(
                "Novo User", "novo@nexusit.com", "senha123", Role.TECHNICIAN);

        User saved = User.builder()
                .id(UUID.randomUUID()).name("Novo User").email("novo@nexusit.com")
                .passwordHash("encoded").role(Role.TECHNICIAN).active(true).build();

        given(userRepository.existsByEmail("novo@nexusit.com")).willReturn(false);
        given(passwordEncoder.encode(any())).willReturn("encoded");
        given(userRepository.save(any())).willReturn(saved);

        mockMvc.perform(post("/api/users")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(objectMapper.writeValueAsString(req)))
                .andExpect(status().isCreated())
                .andExpect(jsonPath("$.email").value("novo@nexusit.com"));
    }

    @Test
    void create_duplicateEmail_returnsConflict() throws Exception {
        UserController.CreateUserRequest req = new UserController.CreateUserRequest(
                "Dup", "dup@nexusit.com", "pass", Role.TECHNICIAN);
        given(userRepository.existsByEmail("dup@nexusit.com")).willReturn(true);

        mockMvc.perform(post("/api/users")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(objectMapper.writeValueAsString(req)))
                .andExpect(status().isConflict());
    }

    @Test
    void delete_existingUser_returnsNoContent() throws Exception {
        UUID id = UUID.randomUUID();
        given(userRepository.existsById(id)).willReturn(true);

        mockMvc.perform(delete("/api/users/{id}", id))
                .andExpect(status().isNoContent());
    }
}
