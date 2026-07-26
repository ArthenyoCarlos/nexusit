package br.com.nexusit.backup;

import java.time.Duration;
import java.time.LocalDateTime;
import java.util.UUID;

public record BackupJobResponse(UUID id, String name, String systemName, String sourceType, String sourceRef, String targetRef, String scheduleLabel, int expectedFrequencyMinutes, int staleAfterMinutes, boolean enabled, String owner, String notes, BackupRunResponse lastRun, String healthStatus, long ageMinutes, String recommendation) {
    public static BackupJobResponse from(BackupJob job, BackupRunResponse lastRun) {
        LocalDateTime now = LocalDateTime.now();
        long age = lastRun == null ? -1 : Duration.between(lastRun.finishedAt(), now).toMinutes();
        String health;
        if (!job.isEnabled()) health = "DISABLED";
        else if (lastRun == null) health = "NO_RUN";
        else if (!"SUCCESS".equalsIgnoreCase(lastRun.status())) health = "FAILED";
        else if (age > job.getStaleAfterMinutes()) health = "STALE";
        else health = "OK";
        String rec = switch (health) {
            case "OK" -> "Backup dentro da janela esperada.";
            case "FAILED" -> "Verificar log da última execução e validar restauração se necessário.";
            case "STALE" -> "Backup sem sucesso recente; executar rotina manual e conferir agendamento.";
            case "NO_RUN" -> "Registrar primeira execução ou configurar coletor automático.";
            default -> "Rotina desabilitada.";
        };
        return new BackupJobResponse(job.getId(), job.getName(), job.getSystemName(), job.getSourceType(), job.getSourceRef(), job.getTargetRef(), job.getScheduleLabel(), job.getExpectedFrequencyMinutes(), job.getStaleAfterMinutes(), job.isEnabled(), job.getOwner(), job.getNotes(), lastRun, health, age, rec);
    }
}
