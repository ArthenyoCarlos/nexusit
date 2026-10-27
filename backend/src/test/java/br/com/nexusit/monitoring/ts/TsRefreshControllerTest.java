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
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.*;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.*;
@WebMvcTest(TsRefreshController.class)
@Import({SecurityConfig.class,JwtAuthenticationFilter.class})
class TsRefreshControllerTest {
 @Autowired MockMvc mvc;
 @MockBean TsRefreshService service;
 @MockBean JwtService jwtService;
 @MockBean UserDetailsService userDetailsService;
 @Test void rejectsAnonymousCollectionAndStatus() throws Exception {
  mvc.perform(post("/api/monitoring/ts-sessions/refresh")).andExpect(status().isForbidden());
  mvc.perform(get("/api/monitoring/ts-sessions/refresh/a")).andExpect(status().isForbidden());
  verifyNoInteractions(service);
 }
 @Test @WithMockUser void authenticatedRequestIsAccepted() throws Exception {
  given(service.request()).willReturn(Map.of("id","a","status","QUEUED"));
  mvc.perform(post("/api/monitoring/ts-sessions/refresh")).andExpect(status().isAccepted()).andExpect(jsonPath("$.id").value("a"));
 }
}
