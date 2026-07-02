package br.com.nexusit.termos;

import jakarta.persistence.*;
import lombok.*;
import java.time.LocalDateTime;
import java.util.UUID;

@Entity
@Table(name = "termo_templates")
@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class TermoTemplate {
    @Id
    @GeneratedValue(strategy = GenerationType.UUID)
    private UUID id;

    @Column(nullable = false)
    private String nome;

    @Column(nullable = false, columnDefinition = "TEXT")
    private String clausulas;

    @Column(columnDefinition = "TEXT")
    private String logoUrl;

    @Column(nullable = false)
    private String logoPosition;

    @Column(nullable = false)
    private LocalDateTime createdAt;

    @Column(nullable = false)
    private LocalDateTime updatedAt;

    @PrePersist
    void pre() {
        createdAt = updatedAt = LocalDateTime.now();
        if (logoPosition == null) logoPosition = "TOPO_CENTRO";
    }

    @PreUpdate
    void upd() { updatedAt = LocalDateTime.now(); }
}
