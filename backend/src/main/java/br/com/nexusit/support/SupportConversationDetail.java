package br.com.nexusit.support;

import java.util.List;

public record SupportConversationDetail(
        SupportConversationSummary conversation,
        List<SupportMessageResponse> messages
) {}
