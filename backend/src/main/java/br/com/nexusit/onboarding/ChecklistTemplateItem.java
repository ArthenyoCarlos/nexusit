package br.com.nexusit.onboarding;

import jakarta.persistence.*;
import lombok.*;

import java.util.UUID;

@Entity
@Table(name = "onboarding_checklist_template_items")
@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class ChecklistTemplateItem {

    @Id
    @GeneratedValue(strategy = GenerationType.UUID)
    private UUID id;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "template_id", nullable = false)
    private ChecklistTemplate template;

    @Column(nullable = false)
    private String title;

    @Column(columnDefinition = "TEXT")
    private String description;

    @Column(name = "item_order")
    private Integer itemOrder;
}
