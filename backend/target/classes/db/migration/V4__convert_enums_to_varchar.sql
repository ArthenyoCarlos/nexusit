-- Converte colunas de tipo enum customizado para VARCHAR
-- necessário para compatibilidade com @Enumerated(EnumType.STRING) do Hibernate

ALTER TABLE inventory_items
  ALTER COLUMN type   TYPE VARCHAR(50) USING type::TEXT,
  ALTER COLUMN status TYPE VARCHAR(50) USING status::TEXT;

ALTER TABLE systems
  ALTER COLUMN category TYPE VARCHAR(50) USING category::TEXT,
  ALTER COLUMN status   TYPE VARCHAR(50) USING status::TEXT;

ALTER TABLE users
  ALTER COLUMN role TYPE VARCHAR(50) USING role::TEXT;

DROP TYPE IF EXISTS item_type CASCADE;
DROP TYPE IF EXISTS item_status CASCADE;
DROP TYPE IF EXISTS system_category CASCADE;
DROP TYPE IF EXISTS system_status CASCADE;
DROP TYPE IF EXISTS user_role CASCADE;
