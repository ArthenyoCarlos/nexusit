CREATE TABLE ticket_asset_links (
    id UUID PRIMARY KEY,
    glpi_ticket_id BIGINT NOT NULL,
    asset_type VARCHAR(20) NOT NULL,
    asset_id UUID NOT NULL,
    asset_name VARCHAR(255) NOT NULL,
    asset_subtitle VARCHAR(100),
    created_by UUID REFERENCES users(id),
    created_at TIMESTAMP NOT NULL,
    CONSTRAINT uq_ticket_asset_link UNIQUE (glpi_ticket_id, asset_type, asset_id)
);

CREATE INDEX idx_ticket_asset_links_ticket ON ticket_asset_links (glpi_ticket_id);
CREATE INDEX idx_ticket_asset_links_asset ON ticket_asset_links (asset_type, asset_id);
