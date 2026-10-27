package br.com.nexusit.whatsapp;

import org.junit.jupiter.api.Test;
import org.springframework.test.util.ReflectionTestUtils;
import org.springframework.test.web.client.MockRestServiceServer;
import org.springframework.web.client.RestTemplate;
import org.springframework.http.MediaType;
import java.util.*;
import static org.junit.jupiter.api.Assertions.*;
import static org.springframework.test.web.client.match.MockRestRequestMatchers.*;
import static org.springframework.test.web.client.response.MockRestResponseCreators.*;

class EvolutionReadContractTest {
    @Test void readUsesOriginalMessageKeysAndRequiresExplicitConfirmation() throws Exception {
        var props = new EvolutionApiProperties();
        props.setBaseUrl("http://evolution.invalid"); props.setApiKey("fixture-key"); props.setInstanceName("fixture");
        var client = new EvolutionApiClient(props);
        var server = MockRestServiceServer.bindTo((RestTemplate) ReflectionTestUtils.getField(client, "restTemplate")).build();
        server.expect(requestTo("http://evolution.invalid/chat/markMessageAsRead/fixture"))
                .andExpect(content().json("{\"readMessages\":[{\"remoteJid\":\"fixture@lid\",\"fromMe\":false,\"id\":\"provider-key\"}]}"))
                .andRespond(withSuccess("{\"message\":\"Read messages\",\"read\":\"success\"}", MediaType.APPLICATION_JSON));
        var method = EvolutionApiClient.class.getMethod("markMessagesRead", List.class);
        assertEquals(true, method.invoke(client, List.of(Map.of("remoteJid", "fixture@lid", "fromMe", false, "id", "provider-key"))));
        server.verify();
    }
}
