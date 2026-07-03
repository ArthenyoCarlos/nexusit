CREATE TABLE ticket_wiki_links (
    id             UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    glpi_ticket_id BIGINT NOT NULL,
    wiki_article_id UUID NOT NULL REFERENCES wiki_articles(id) ON DELETE CASCADE,
    created_by     UUID REFERENCES users(id),
    created_at     TIMESTAMP NOT NULL DEFAULT NOW(),
    CONSTRAINT uk_ticket_wiki_links UNIQUE (glpi_ticket_id, wiki_article_id)
);

CREATE INDEX idx_ticket_wiki_links_glpi_ticket_id ON ticket_wiki_links(glpi_ticket_id);
CREATE INDEX idx_ticket_wiki_links_wiki_article_id ON ticket_wiki_links(wiki_article_id);
