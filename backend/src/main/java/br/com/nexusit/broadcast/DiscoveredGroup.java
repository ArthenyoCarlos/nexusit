package br.com.nexusit.broadcast;

/** A WhatsApp group as reported live by the Evolution API, not yet saved as a NotificationGroup. */
public record DiscoveredGroup(String groupJid, String name, int participantCount, boolean alreadySaved) {}
