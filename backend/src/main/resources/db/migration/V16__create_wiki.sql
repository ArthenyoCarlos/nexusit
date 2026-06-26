CREATE TABLE wiki_articles (
    id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    title      VARCHAR(300) NOT NULL,
    category   VARCHAR(100) NOT NULL DEFAULT 'Geral',
    content    TEXT NOT NULL DEFAULT '',
    tags       VARCHAR(500),
    author_id  UUID REFERENCES users(id),
    created_at TIMESTAMP NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMP NOT NULL DEFAULT NOW()
);
