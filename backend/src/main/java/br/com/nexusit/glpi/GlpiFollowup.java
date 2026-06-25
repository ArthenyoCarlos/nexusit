package br.com.nexusit.glpi;

public record GlpiFollowup(
        int id,
        String author,
        String content,
        String date
) {}
