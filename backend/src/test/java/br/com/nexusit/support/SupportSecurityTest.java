package br.com.nexusit.support;

import br.com.nexusit.auth.JwtAuthenticationFilter;
import br.com.nexusit.auth.JwtService;
import br.com.nexusit.config.SecurityConfig;
import br.com.nexusit.user.*;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.autoconfigure.web.servlet.WebMvcTest;
import org.springframework.boot.test.mock.mockito.MockBean;
import org.springframework.context.annotation.Import;
import org.springframework.security.core.userdetails.UserDetailsService;
import org.springframework.test.web.servlet.MockMvc;
import java.util.UUID;
import static org.mockito.Mockito.*;
import static org.springframework.security.test.web.servlet.request.SecurityMockMvcRequestPostProcessors.user;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.*;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.*;

@WebMvcTest(SupportController.class)
@Import({SecurityConfig.class, JwtAuthenticationFilter.class})
class SupportSecurityTest {
    @Autowired MockMvc mvc;
    @MockBean SupportService service;
    @MockBean JwtService jwtService;
    @MockBean UserDetailsService userDetailsService;

    @Test void anonymousCannotReadOrSendReadReceipts() throws Exception {
        var id = UUID.randomUUID();
        mvc.perform(get("/api/support/" + id)).andExpect(status().isUnauthorized());
        mvc.perform(post("/api/support/" + id + "/read").contentType("application/json").content("{}"))
                .andExpect(status().isUnauthorized());
        verifyNoInteractions(service);
    }

    @Test void authenticatedReadUsesActualPrincipalAndDisplayedCursor() throws Exception {
        var principal = User.builder().id(UUID.randomUUID()).name("Fixture").email("fixture@example.test").role(Role.TECHNICIAN).build();
        var id = UUID.randomUUID(); var cursor = UUID.randomUUID();
        when(service.markRead(id, principal, cursor)).thenReturn(new SupportReadResponse(true, 1, "PENDING", null));
        mvc.perform(post("/api/support/" + id + "/read").with(user(principal)).contentType("application/json")
                .content("{\"throughMessageId\":\"" + cursor + "\"}"))
                .andExpect(status().isOk()).andExpect(jsonPath("$.unreadCount").value(1))
                .andExpect(jsonPath("$.remoteRead").value("PENDING"));
        verify(service).markRead(id, principal, cursor);
    }

    @Test void authenticatedGetDoesNotMarkRead() throws Exception {
        var id = UUID.randomUUID();
        mvc.perform(get("/api/support/" + id).with(user("fixture"))).andExpect(status().isOk());
        verify(service).getDetail(id); verifyNoMoreInteractions(service);
    }
}
