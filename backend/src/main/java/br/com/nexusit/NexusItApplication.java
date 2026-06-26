package br.com.nexusit;

import org.springframework.boot.SpringApplication;
import org.springframework.boot.autoconfigure.SpringBootApplication;
import org.springframework.scheduling.annotation.EnableScheduling;

@SpringBootApplication
@EnableScheduling
public class NexusItApplication {
    public static void main(String[] args) {
        SpringApplication.run(NexusItApplication.class, args);
    }
}
