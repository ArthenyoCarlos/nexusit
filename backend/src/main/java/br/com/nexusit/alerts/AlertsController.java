package br.com.nexusit.alerts;

import lombok.RequiredArgsConstructor;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

@RestController
@RequestMapping("/api/alerts")
@RequiredArgsConstructor
public class AlertsController {

    private final AlertsService service;

    @GetMapping("/summary")
    public AlertsSummary getSummary() {
        return service.getSummary();
    }
}
