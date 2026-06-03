-- Fase 2: prijzen + voorkeurswinkel (uitvoeren op database boodschap)
USE boodschap;

ALTER TABLE households
  ADD COLUMN IF NOT EXISTS preferred_store VARCHAR(32) NULL
    COMMENT 'ah, jumbo, plus, …';

CREATE TABLE IF NOT EXISTS price_cache (
  ean VARCHAR(32) NOT NULL,
  store VARCHAR(32) NOT NULL,
  price_cents INT UNSIGNED NOT NULL,
  currency CHAR(3) NOT NULL DEFAULT 'EUR',
  product_name VARCHAR(255) NOT NULL DEFAULT '',
  unit_size VARCHAR(64) NULL,
  url VARCHAR(512) NULL,
  is_promo TINYINT(1) NOT NULL DEFAULT 0,
  old_price_cents INT UNSIGNED NULL,
  source VARCHAR(16) NOT NULL DEFAULT 'checkjebon',
  fetched_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (ean, store),
  INDEX idx_price_cache_fetched (fetched_at)
) ENGINE=InnoDB;
