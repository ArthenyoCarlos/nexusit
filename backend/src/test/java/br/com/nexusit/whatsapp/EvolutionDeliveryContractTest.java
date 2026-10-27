package br.com.nexusit.whatsapp;

import org.junit.jupiter.api.Test;
import org.springframework.test.util.ReflectionTestUtils;
import org.springframework.test.web.client.MockRestServiceServer;
import org.springframework.web.client.RestTemplate;
import org.springframework.http.*;
import java.lang.reflect.InvocationTargetException;
import static org.junit.jupiter.api.Assertions.*;
import static org.springframework.test.web.client.match.MockRestRequestMatchers.*;
import static org.springframework.test.web.client.response.MockRestResponseCreators.*;

class EvolutionDeliveryContractTest {
    EvolutionApiClient client() {
        var p = new EvolutionApiProperties(); p.setBaseUrl("http://evolution.invalid"); p.setApiKey("fixture-key"); p.setInstanceName("fixture");
        return new EvolutionApiClient(p);
    }
    @Test void strictAudioRejectsHttpErrorsWithoutRetry() throws Exception {
        var c = client();
        var server = MockRestServiceServer.bindTo((RestTemplate) ReflectionTestUtils.getField(c, "mediaRestTemplate")).build();
        server.expect(requestTo("http://evolution.invalid/message/sendWhatsAppAudio/fixture"))
                .andExpect(content().json("{\"number\":\"fixture\",\"audio\":\"AQID\"}"))
                .andRespond(withStatus(HttpStatus.BAD_REQUEST));
        assertThrows(RuntimeException.class, () -> c.sendWhatsAppAudioOrThrow("fixture", new byte[]{1,2,3}));
        server.verify();
    }
    @Test void strictTextRequiresProviderMessageIdAcknowledgement() {
        var c = client();
        var server = MockRestServiceServer.bindTo((RestTemplate) ReflectionTestUtils.getField(c, "restTemplate")).build();
        server.expect(requestTo("http://evolution.invalid/message/sendText/fixture"))
                .andRespond(withSuccess("{}", MediaType.APPLICATION_JSON));
        assertThrows(RuntimeException.class, () -> c.sendTextOrThrow("fixture", "fixture")); server.verify();
    }
    @Test void acknowledgedAudioSucceeds() {
        var c = client();
        var server = MockRestServiceServer.bindTo((RestTemplate) ReflectionTestUtils.getField(c, "mediaRestTemplate")).build();
        server.expect(requestTo("http://evolution.invalid/message/sendWhatsAppAudio/fixture"))
                .andRespond(withSuccess("{\"key\":{\"id\":\"ack-fixture\"}}", MediaType.APPLICATION_JSON));
        assertDoesNotThrow(() -> c.sendWhatsAppAudioOrThrow("fixture", new byte[]{1})); server.verify();
    }
}
