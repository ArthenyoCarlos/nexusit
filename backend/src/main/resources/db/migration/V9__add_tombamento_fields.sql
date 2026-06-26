ALTER TABLE inventory_items
    ADD COLUMN tombamento    VARCHAR(20)    UNIQUE,
    ADD COLUMN warranty_until DATE,
    ADD COLUMN value         NUMERIC(12,2);

CREATE INDEX idx_inventory_tombamento ON inventory_items(tombamento);
