package br.com.nexusit.planning;

import br.com.nexusit.user.User;
import jakarta.persistence.*;
import lombok.*;

import java.util.UUID;

@Entity
@Table(name = "planning_task_members")
@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class PlanningTaskMember {

    @Id
    @GeneratedValue(strategy = GenerationType.UUID)
    private UUID id;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "task_id", nullable = false)
    @ToString.Exclude
    @EqualsAndHashCode.Exclude
    private PlanningTask task;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "user_id", nullable = false)
    private User user;
}
