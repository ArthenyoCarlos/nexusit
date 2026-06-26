package br.com.nexusit.contracts;

import br.com.nexusit.user.User;
import jakarta.persistence.*;
import lombok.*;
import java.math.BigDecimal;
import java.time.LocalDate;
import java.time.LocalDateTime;
import java.util.UUID;

@Entity @Table(name = "contracts") @Data @Builder @NoArgsConstructor @AllArgsConstructor
public class Contract {
    @Id @GeneratedValue(strategy = GenerationType.UUID)
    private UUID id;
    @Column(nullable = false) private String name;
    private String vendor;
    private String contactName;
    private String contactEmail;
    private String contactPhone;
    @Column(nullable = false) private String type; // MENSAL, ANUAL, UNICO
    private BigDecimal value;
    private LocalDate startDate;
    private LocalDate endDate;
    @Column(nullable = false) private boolean autoRenew;
    @Column(columnDefinition = "TEXT") private String notes;
    @ManyToOne(fetch = FetchType.LAZY) @JoinColumn(name = "created_by") private User createdBy;
    @Column(nullable = false) private LocalDateTime createdAt;
    @Column(nullable = false) private LocalDateTime updatedAt;

    @PrePersist void pre() { createdAt = updatedAt = LocalDateTime.now(); }
    @PreUpdate  void upd() { updatedAt = LocalDateTime.now(); }
}
