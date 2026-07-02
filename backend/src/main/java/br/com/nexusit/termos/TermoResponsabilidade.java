package br.com.nexusit.termos;

import jakarta.persistence.*;
import lombok.*;
import java.time.LocalDate;
import java.time.LocalDateTime;
import java.util.*;

@Entity
@Table(name = "termos_responsabilidade")
@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class TermoResponsabilidade {
    @Id
    @GeneratedValue(strategy = GenerationType.UUID)
    private UUID id;

    @Column(nullable = false, unique = true, length = 20)
    private String numeroTermo;

    @Column(nullable = false)
    private String responsavelNome;

    private String cpf;
    private String cargo;
    private String setor;

    @Column(nullable = false)
    private LocalDate dataEntrega;

    @Column(nullable = false)
    private String tipoEquipamento;

    private String marca;
    private String modelo;
    private String numeroSerie;

    @Column(nullable = false, unique = true, length = 20)
    private String tombamento;

    @Column(columnDefinition = "TEXT")
    private String condicaoInicial;

    @Column(columnDefinition = "TEXT")
    private String observacoes;

    @Column(columnDefinition = "TEXT")
    private String acessoriosJson;

    @Enumerated(EnumType.STRING)
    @Column(nullable = false)
    @Builder.Default
    private TermoStatus status = TermoStatus.ATIVO;

    @Column(columnDefinition = "TEXT")
    private String assinaturaDigital;

    private LocalDateTime dataHoraAssinatura;
    private String ipAssinante;
    private String hashDocumento;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "template_id")
    private TermoTemplate template;

    @OneToMany(mappedBy = "termo", cascade = CascadeType.ALL, orphanRemoval = true)
    @OrderBy("data DESC")
    @Builder.Default
    private List<OcorrenciaTermo> ocorrencias = new ArrayList<>();

    @Column(nullable = false)
    private LocalDateTime createdAt;

    @Column(nullable = false)
    private LocalDateTime updatedAt;

    @PrePersist
    void pre() {
        createdAt = updatedAt = LocalDateTime.now();
        if (status == null) status = TermoStatus.ATIVO;
    }

    @PreUpdate
    void upd() { updatedAt = LocalDateTime.now(); }
}
