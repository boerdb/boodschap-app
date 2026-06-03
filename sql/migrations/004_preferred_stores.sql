-- Meerdere voorkeurswinkels per huishouden (JSON-array)
USE boodschap;

ALTER TABLE households
  ADD COLUMN IF NOT EXISTS preferred_stores JSON NULL
    COMMENT '["ah","jumbo",…]';

UPDATE households
  SET preferred_stores = JSON_ARRAY(preferred_store)
  WHERE preferred_store IS NOT NULL
    AND preferred_store <> ''
    AND (preferred_stores IS NULL OR JSON_LENGTH(preferred_stores) = 0);
