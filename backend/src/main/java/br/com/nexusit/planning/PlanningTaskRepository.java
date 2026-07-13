package br.com.nexusit.planning;

import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;

import java.util.List;
import java.util.UUID;

public interface PlanningTaskRepository extends JpaRepository<PlanningTask, UUID> {

    @Query("""
            SELECT DISTINCT t FROM PlanningTask t
            LEFT JOIN FETCH t.assignee
            LEFT JOIN FETCH t.members m
            LEFT JOIN FETCH m.user
            ORDER BY t.columnName, t.columnOrder, t.createdAt
            """)
    List<PlanningTask> findAllWithAssignee();
}
