package br.com.nexusit.broadcast;

import br.com.nexusit.support.WhatsappContact;

import java.util.UUID;

public record BroadcastContact(UUID id, String phoneNumber, String displayName) {
    public static BroadcastContact from(WhatsappContact c) {
        return new BroadcastContact(c.getId(), c.getPhoneNumber(), c.getDisplayName());
    }
}
