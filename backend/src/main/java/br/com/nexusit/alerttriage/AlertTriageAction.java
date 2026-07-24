package br.com.nexusit.alerttriage;

public enum AlertTriageAction {
    SHOW_ONLY,
    CREATE_TICKET_IMMEDIATELY,
    CREATE_TICKET_AFTER_DELAY,
    CREATE_TICKET_ON_RECURRENCE,
    IGNORE,
    SILENCE_TEMPORARILY
}
