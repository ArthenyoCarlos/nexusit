package br.com.nexusit.financial;

import br.com.nexusit.user.User;
import jakarta.persistence.*;
import lombok.*;
import java.math.BigDecimal;
import java.time.LocalDate;
import java.time.LocalDateTime;
import java.util.UUID;

@Entity @Table(name = "financial_bills") @Data @Builder @NoArgsConstructor @AllArgsConstructor
public class Bill {
    @Id @GeneratedValue(strategy = GenerationType.UUID)
    private UUID id;
    @Column(nullable = false) private String title;
    private String vendor;
    private String category;
    @Column(nullable = false) private BigDecimal amount;
    @Column(nullable = false) private LocalDate dueDate;
    @Column(nullable = false) private boolean paid;
    private LocalDate paidAt;
    @Column(columnDefinition = "TEXT") private String notes;
    @ManyToOne(fetch = FetchType.LAZY) @JoinColumn(name = "created_by") private User createdBy;
    @Column(nullable = false) private LocalDateTime createdAt;

    @PrePersist void pre() { createdAt = LocalDateTime.now(); }
}
