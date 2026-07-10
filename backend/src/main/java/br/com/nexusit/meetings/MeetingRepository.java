package br.com.nexusit.meetings;

import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;

import java.util.List;
import java.util.UUID;

public interface MeetingRepository extends JpaRepository<Meeting, UUID> {

    @Query("SELECT m FROM Meeting m LEFT JOIN FETCH m.createdBy ORDER BY m.meetingDate DESC, m.createdAt DESC")
    List<Meeting> findAllWithRelations();
}
