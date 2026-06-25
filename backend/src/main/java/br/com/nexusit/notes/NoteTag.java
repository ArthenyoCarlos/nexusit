package br.com.nexusit.notes;

import jakarta.persistence.*;
import lombok.*;

import java.util.UUID;

@Entity
@Table(name = "note_tags")
@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class NoteTag {

    @Id
    @GeneratedValue(strategy = GenerationType.UUID)
    private UUID id;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "note_id", nullable = false)
    @ToString.Exclude
    @EqualsAndHashCode.Exclude
    private Note note;

    private String tag;
    private String category;
}
