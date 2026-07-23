package br.com.nexusit.inventory;

import br.com.nexusit.TestSecurityConfig;
import com.fasterxml.jackson.databind.ObjectMapper;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.autoconfigure.web.servlet.WebMvcTest;
import org.springframework.boot.test.mock.mockito.MockBean;
import org.springframework.context.annotation.Import;
import org.springframework.data.domain.PageImpl;
import org.springframework.http.MediaType;
import org.springframework.test.web.servlet.MockMvc;

import java.time.LocalDateTime;
import java.util.List;
import java.util.UUID;

import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.isNull;
import static org.mockito.BDDMockito.given;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.*;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.*;

@WebMvcTest(InventoryController.class)
@Import(TestSecurityConfig.class)
class InventoryControllerTest {

    @Autowired MockMvc mockMvc;
    @Autowired ObjectMapper objectMapper;
    @MockBean InventoryService service;
    @MockBean LabelService labelService;

    private InventoryResponse sampleResponse() {
        return new InventoryResponse(
                UUID.randomUUID(), "GAL-2026-001", "Computador Dell", ItemType.COMPUTADOR,
                "Dell", "Optiplex 7090", "SN-001", "TI",
                null, null, null, null, ItemStatus.ACTIVE, null, LocalDateTime.now()
        );
    }

    @Test
    void listAll_returnsOkWithItems() throws Exception {
        given(service.findAll(isNull(), isNull(), isNull(), isNull(), isNull(), isNull(),
                isNull(), isNull(), isNull(), isNull(), any()))
                .willReturn(new PageImpl<>(List.of(sampleResponse())));

        mockMvc.perform(get("/api/inventory"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.content[0].name").value("Computador Dell"))
                .andExpect(jsonPath("$.content[0].type").value("COMPUTADOR"));
    }

    @Test
    void findById_notFound_returns404() throws Exception {
        given(service.findById(any())).willThrow(
                new org.springframework.web.server.ResponseStatusException(
                        org.springframework.http.HttpStatus.NOT_FOUND));

        mockMvc.perform(get("/api/inventory/{id}", UUID.randomUUID()))
                .andExpect(status().isNotFound());
    }

    @Test
    void create_validRequest_returnsCreated() throws Exception {
        InventoryRequest req = new InventoryRequest(
                "Impressora HP", ItemType.IMPRESSORA, null, null, "SN-002", "TI", null, null, ItemStatus.ACTIVE, null, null, null);
        given(service.create(any())).willReturn(sampleResponse());

        mockMvc.perform(post("/api/inventory")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(objectMapper.writeValueAsString(req)))
                .andExpect(status().isCreated());
    }
}
