package br.com.nexusit.whatsapp;

import br.com.nexusit.support.*;
import com.fasterxml.jackson.databind.ObjectMapper;
import org.junit.jupiter.api.Test;
import org.mockito.ArgumentCaptor;
import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.Mockito.*;

class WhatsappWebhookIdentityTest {
    @Test void originalIdentitySurvivesAlternateContactResolution() throws Exception {
        var engine = mock(SupportConversationEngine.class);
        var controller = new WhatsappWebhookController(new EvolutionApiProperties(), engine);
        controller.receive(new ObjectMapper().readTree("""
            {"event":"messages.upsert","data":{"key":{"remoteJid":"fixture@lid","remoteJidAlt":"fixture@s.whatsapp.net","fromMe":false,"id":"provider-original"},"message":{"conversation":"fixture"}}}
            """), null, null);
        var captor = ArgumentCaptor.forClass(InboundWhatsappMessage.class);
        verify(engine).onInboundMessage(captor.capture());
        assertEquals("provider-original", captor.getValue().getClass().getMethod("providerMessageId").invoke(captor.getValue()));
        assertEquals("fixture@lid", captor.getValue().getClass().getMethod("remoteJid").invoke(captor.getValue()));
    }
}
