package br.com.nexusit.termos;

import jakarta.persistence.*;
import lombok.*;
import java.math.BigDecimal;
import java.time.LocalDateTime;
import java.util.UUID;

@Entity
@Table(name = "ocorrencias_termo")
@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class OcorrenciaTermo {
    @Id
    @GeneratedValue(strategy = GenerationType.UUID)
    private UUID id;

    @ManyToOne(fetch = FetchType.LAZY, optional = false)
    @JoinColumn(name = "termo_id")
    private TermoResponsabilidade termo;

    @Column(nullable = false)
    private LocalDateTime data;

    @Enumerated(EnumType.STRING)
    @Column(nullable = false)
    private OcorrenciaTipo tipo;

    @Column(nullable = false, columnDefinition = "TEXT")
    private String descricao;

    @Column(columnDefinition = "TEXT")
    private String pecasSubstituidas;

    private BigDecimal custo;

    @Enumerated(EnumType.STRING)
    private ResponsabilidadeOcorrencia responsabilidade;

    private String registradoPor;

    @Column(nullable = false)
    private LocalDateTime createdAt;

    @PrePersist
    void pre() {
        if (data == null) data = LocalDateTime.now();
        createdAt = LocalDateTime.now();
    }
}
