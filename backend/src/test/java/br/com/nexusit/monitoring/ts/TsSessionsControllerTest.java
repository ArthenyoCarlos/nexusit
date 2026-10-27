package br.com.nexusit.monitoring.ts;

import br.com.nexusit.auth.JwtAuthenticationFilter;
import br.com.nexusit.auth.JwtService;
import br.com.nexusit.config.SecurityConfig;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.autoconfigure.web.servlet.WebMvcTest;
import org.springframework.boot.test.mock.mockito.MockBean;
import org.springframework.context.annotation.Import;
import org.springframework.security.core.userdetails.UserDetailsService;
import org.springframework.security.test.context.support.WithMockUser;
import org.springframework.test.web.servlet.MockMvc;

import java.util.Map;

import static org.mockito.BDDMockito.given;
import static org.mockito.Mockito.verifyNoInteractions;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.*;

@WebMvcTest(TsSessionsController.class)
@Import({SecurityConfig.class, JwtAuthenticationFilter.class})
class TsSessionsControllerTest {
    @Autowired MockMvc mvc;
    @MockBean TsSessionsService service;
    @MockBean JwtService jwtService;
    @MockBean UserDetailsService userDetailsService;

    @Test
    void anonymousIsRejectedDespiteExistingMonitoringPermitAll() throws Exception {
        mvc.perform(get("/api/monitoring/ts-sessions")).andExpect(status().isForbidden());
        verifyNoInteractions(service);
    }

    @Test
    @WithMockUser
    void authenticatedUserCanReadSnapshotWithoutCaching() throws Exception {
        given(service.getSnapshot()).willReturn(Map.of("status", "UNAVAILABLE", "readOnly", true));
        mvc.perform(get("/api/monitoring/ts-sessions"))
                .andExpect(status().isOk()).andExpect(jsonPath("$.status").value("UNAVAILABLE"))
                .andExpect(jsonPath("$.readOnly").value(true))
                .andExpect(header().string("Cache-Control", org.hamcrest.Matchers.containsString("no-store")));
    }

    @Test
    @WithMockUser
    void noWriteEndpointExists() throws Exception {
        mvc.perform(post("/api/monitoring/ts-sessions")).andExpect(status().isMethodNotAllowed());
        verifyNoInteractions(service);
    }
}
