package br.com.nexusit.networkdoc;

import br.com.nexusit.TestSecurityConfig;
import com.fasterxml.jackson.databind.ObjectMapper;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.autoconfigure.web.servlet.WebMvcTest;
import org.springframework.boot.test.mock.mockito.MockBean;
import org.springframework.context.annotation.Import;
import org.springframework.http.MediaType;
import org.springframework.test.web.servlet.MockMvc;

import java.time.OffsetDateTime;
import java.util.List;
import java.util.UUID;

import static org.mockito.ArgumentMatchers.any;
import static org.mockito.BDDMockito.given;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.*;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.*;

@WebMvcTest(NetworkDocController.class)
@Import(TestSecurityConfig.class)
class NetworkDocControllerTest {

    @Autowired MockMvc mockMvc;
    @Autowired ObjectMapper objectMapper;
    @MockBean NetworkDocService service;

    @Test
    void findAll_returnsOkWithDocs() throws Exception {
        NetworkDocResponse doc = new NetworkDocResponse(
                UUID.randomUUID(), "Topologia Geral", "Topologia",
                "# Topologia\nConteúdo", "Admin", OffsetDateTime.now()
        );
        given(service.findAll()).willReturn(List.of(doc));

        mockMvc.perform(get("/api/network-docs"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$[0].title").value("Topologia Geral"))
                .andExpect(jsonPath("$[0].section").value("Topologia"));
    }

    @Test
    void findBySection_returnsSectionDocs() throws Exception {
        NetworkDocResponse doc = new NetworkDocResponse(
                UUID.randomUUID(), "VLANs Corporativas", "VLANs",
                "## VLANs", "Admin", OffsetDateTime.now()
        );
        given(service.findBySection("VLANs")).willReturn(List.of(doc));

        mockMvc.perform(get("/api/network-docs").param("section", "VLANs"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$[0].section").value("VLANs"));
    }

    @Test
    void create_validRequest_returnsCreated() throws Exception {
        NetworkDocRequest req = new NetworkDocRequest("Runbook Deploy", "Runbooks", "Passos para deploy...");
        NetworkDocResponse res = new NetworkDocResponse(
                UUID.randomUUID(), "Runbook Deploy", "Runbooks",
                "Passos para deploy...", "Admin", OffsetDateTime.now()
        );
        given(service.create(any(), any())).willReturn(res);

        mockMvc.perform(post("/api/network-docs")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(objectMapper.writeValueAsString(req)))
                .andExpect(status().isCreated())
                .andExpect(jsonPath("$.title").value("Runbook Deploy"));
    }

    @Test
    void delete_callsService_returnsNoContent() throws Exception {
        mockMvc.perform(delete("/api/network-docs/{id}", UUID.randomUUID()))
                .andExpect(status().isNoContent());
    }
}
