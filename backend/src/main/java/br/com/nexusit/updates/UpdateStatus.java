package br.com.nexusit.updates;

public record UpdateStatus(
        String currentCommit,
        String latestCommit,
        boolean updateAvailable,
        String changelog,
        boolean updating,
        String lastUpdateAt,
        String lastError,
        boolean available
) {
    public static UpdateStatus unavailable() {
        return new UpdateStatus(null, null, false, null, false, null, null, false);
    }
}
