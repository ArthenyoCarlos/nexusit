-- Busca da Wiki com stemming em portugues (plural/conjugacao batem sozinhos) e
-- tolerancia a erro de digitacao no titulo, sem precisar de nenhum servico externo.
CREATE EXTENSION IF NOT EXISTS pg_trgm;

ALTER TABLE wiki_articles ADD COLUMN search_vector tsvector;

CREATE FUNCTION wiki_articles_tsvector_update() RETURNS trigger AS $$
BEGIN
    NEW.search_vector :=
        setweight(to_tsvector('portuguese', coalesce(NEW.title, '')), 'A') ||
        setweight(to_tsvector('portuguese', coalesce(NEW.tags, '')), 'B') ||
        setweight(to_tsvector('portuguese', coalesce(NEW.category, '')), 'B') ||
        setweight(to_tsvector('portuguese', coalesce(NEW.content, '')), 'C');
    RETURN NEW;
END
$$ LANGUAGE plpgsql;

CREATE TRIGGER wiki_articles_tsvector_trigger
    BEFORE INSERT OR UPDATE ON wiki_articles
    FOR EACH ROW EXECUTE FUNCTION wiki_articles_tsvector_update();

-- preenche o vetor de busca dos artigos que ja existem
UPDATE wiki_articles SET
    search_vector =
        setweight(to_tsvector('portuguese', coalesce(title, '')), 'A') ||
        setweight(to_tsvector('portuguese', coalesce(tags, '')), 'B') ||
        setweight(to_tsvector('portuguese', coalesce(category, '')), 'B') ||
        setweight(to_tsvector('portuguese', coalesce(content, '')), 'C');

CREATE INDEX idx_wiki_articles_search_vector ON wiki_articles USING GIN(search_vector);
CREATE INDEX idx_wiki_articles_title_trgm ON wiki_articles USING GIN(title gin_trgm_ops);
