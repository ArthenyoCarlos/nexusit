package br.com.nexusit.backup;

import java.time.Duration;
import java.time.LocalDateTime;
import java.util.UUID;

public record BackupJobResponse(
        UUID id,
        String name,
        String systemName,
        String sourceType,
        String sourceRef,
        String targetRef,
        String scheduleLabel,
        int expectedFrequencyMinutes,
        int staleAfterMinutes,
        boolean enabled,
        String owner,
        String notes,
        BackupRunResponse lastRun,
        BackupRestoreTestResponse lastRestoreTest,
        BackupActionRequestResponse lastRequest,
        String healthStatus,
        String restoreStatus,
        long ageMinutes,
        long restoreAgeDays,
        String recommendation
) {
    private static final long RESTORE_STALE_DAYS = 30;

    public static BackupJobResponse from(BackupJob job, BackupRunResponse lastRun, BackupRestoreTestResponse lastRestoreTest, BackupActionRequestResponse lastRequest) {
        LocalDateTime now = LocalDateTime.now();
        long age = lastRun == null ? -1 : Duration.between(lastRun.finishedAt(), now).toMinutes();
        long restoreAgeDays = lastRestoreTest == null ? -1 : Duration.between(lastRestoreTest.testedAt(), now).toDays();

        String backupHealth;
        if (!job.isEnabled()) backupHealth = "DISABLED";
        else if (lastRun == null) backupHealth = "NO_RUN";
        else if (!"SUCCESS".equalsIgnoreCase(lastRun.status())) backupHealth = "FAILED";
        else if (age > job.getStaleAfterMinutes()) backupHealth = "STALE";
        else backupHealth = "OK";

        String restoreHealth;
        if (!job.isEnabled()) restoreHealth = "DISABLED";
        else if (lastRestoreTest == null) restoreHealth = "NO_RESTORE";
        else if (!"SUCCESS".equalsIgnoreCase(lastRestoreTest.status())) restoreHealth = "RESTORE_FAILED";
        else if (restoreAgeDays > RESTORE_STALE_DAYS) restoreHealth = "RESTORE_STALE";
        else restoreHealth = "RESTORE_OK";

        String recommendation;
        if ("FAILED".equals(backupHealth)) recommendation = "Backup falhou; verificar log e executar nova tentativa antes de qualquer manutenção.";
        else if ("STALE".equals(backupHealth)) recommendation = "Backup atrasado; executar rotina manual e conferir agendamento.";
        else if ("NO_RUN".equals(backupHealth)) recommendation = "Nenhum backup registrado; executar backup agora.";
        else if ("NO_RESTORE".equals(restoreHealth)) recommendation = "Backup existe, mas ainda não há teste de restauração registrado.";
        else if ("RESTORE_FAILED".equals(restoreHealth)) recommendation = "Último teste de restauração falhou; validar arquivo e procedimento antes de confiar no backup.";
        else if ("RESTORE_STALE".equals(restoreHealth)) recommendation = "Teste de restauração antigo; repetir validação mensal.";
        else recommendation = "Backup e teste de restauração dentro da política.";

        return new BackupJobResponse(
                job.getId(), job.getName(), job.getSystemName(), job.getSourceType(), job.getSourceRef(), job.getTargetRef(), job.getScheduleLabel(),
                job.getExpectedFrequencyMinutes(), job.getStaleAfterMinutes(), job.isEnabled(), job.getOwner(), job.getNotes(),
                lastRun, lastRestoreTest, lastRequest, backupHealth, restoreHealth, age, restoreAgeDays, recommendation);
    }
}
