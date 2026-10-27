package br.com.nexusit.config;
import org.junit.jupiter.api.Test;
import org.springframework.web.bind.annotation.*;
import org.springframework.web.multipart.MaxUploadSizeExceededException;
import org.springframework.web.server.ResponseStatusException;
import org.springframework.http.HttpStatus;
import org.springframework.test.web.servlet.setup.MockMvcBuilders;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.*;

class CrmUploadErrorsTest {
 @RestController static class Probe {
  @PostMapping("/test-size") public void size(){throw new MaxUploadSizeExceededException(32*1024*1024);}
  @PostMapping("/test-upstream") public void upstream(){throw new ResponseStatusException(HttpStatus.BAD_GATEWAY,"Envio sem confirmação; confira o histórico antes de reenviar");}
 }
 @Test void oversizeReturnsActionable413WithoutAuthErrorDispatch() throws Exception {
  MockMvcBuilders.standaloneSetup(new Probe()).setControllerAdvice(new GlobalExceptionHandler()).build()
   .perform(post("/test-size")).andExpect(status().isPayloadTooLarge()).andExpect(jsonPath("$.detail").value(org.hamcrest.Matchers.containsString("32 MB")));
 }
 @Test void upstreamFailurePreservesSanitizedReason() throws Exception {
  MockMvcBuilders.standaloneSetup(new Probe()).setControllerAdvice(new GlobalExceptionHandler()).build()
   .perform(post("/test-upstream")).andExpect(status().isBadGateway()).andExpect(jsonPath("$.detail").value(org.hamcrest.Matchers.containsString("confira o histórico")));
 }
}
