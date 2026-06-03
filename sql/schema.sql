-- Boodschappenlijst — MariaDB schema (server DB: 192.168.1.14)
-- Uitvoeren als root in phpMyAdmin of: mysql -uroot -p < sql/schema.sql

CREATE DATABASE IF NOT EXISTS boodschap
  CHARACTER SET utf8mb4
  COLLATE utf8mb4_unicode_ci;

USE boodschap;

CREATE TABLE IF NOT EXISTS households (
  id INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  name VARCHAR(120) NOT NULL,
  invite_code VARCHAR(32) NOT NULL UNIQUE,
  preferred_store VARCHAR(32) NULL,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
) ENGINE=InnoDB;

CREATE TABLE IF NOT EXISTS users (
  id INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  display_name VARCHAR(80) NOT NULL,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
) ENGINE=InnoDB;

CREATE TABLE IF NOT EXISTS household_members (
  household_id INT UNSIGNED NOT NULL,
  user_id INT UNSIGNED NOT NULL,
  role ENUM('member', 'admin') NOT NULL DEFAULT 'member',
  PRIMARY KEY (household_id, user_id),
  FOREIGN KEY (household_id) REFERENCES households(id) ON DELETE CASCADE,
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
) ENGINE=InnoDB;

CREATE TABLE IF NOT EXISTS sessions (
  token CHAR(64) PRIMARY KEY,
  user_id INT UNSIGNED NOT NULL,
  household_id INT UNSIGNED NOT NULL,
  expires_at DATETIME NOT NULL,
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
  FOREIGN KEY (household_id) REFERENCES households(id) ON DELETE CASCADE,
  INDEX idx_sessions_expires (expires_at)
) ENGINE=InnoDB;

CREATE TABLE IF NOT EXISTS list_items (
  id INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  household_id INT UNSIGNED NOT NULL,
  barcode VARCHAR(32) NULL,
  name VARCHAR(255) NOT NULL,
  quantity DECIMAL(8,2) NOT NULL DEFAULT 1,
  checked TINYINT(1) NOT NULL DEFAULT 0,
  added_by INT UNSIGNED NULL,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  FOREIGN KEY (household_id) REFERENCES households(id) ON DELETE CASCADE,
  FOREIGN KEY (added_by) REFERENCES users(id) ON DELETE SET NULL,
  INDEX idx_list_household_updated (household_id, updated_at)
) ENGINE=InnoDB;

CREATE TABLE IF NOT EXISTS product_cache (
  ean VARCHAR(32) PRIMARY KEY,
  name VARCHAR(255) NOT NULL,
  brand VARCHAR(120) NULL,
  image_url VARCHAR(512) NULL,
  off_json JSON NULL,
  cached_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  INDEX idx_product_cache_cached (cached_at)
) ENGINE=InnoDB;

CREATE TABLE IF NOT EXISTS checkjebon_dataset (
  id TINYINT UNSIGNED NOT NULL PRIMARY KEY DEFAULT 1,
  payload LONGTEXT NOT NULL,
  source_url VARCHAR(512) NOT NULL,
  byte_size INT UNSIGNED NOT NULL DEFAULT 0,
  store_count SMALLINT UNSIGNED NULL,
  synced_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
) ENGINE=InnoDB;

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

INSERT INTO households (name, invite_code)
SELECT 'Thuis', 'THUIS'
WHERE NOT EXISTS (SELECT 1 FROM households WHERE invite_code = 'THUIS');

-- App-user (pas wachtwoord aan; niet root in DATABASE_URL):
-- CREATE USER 'boodschap'@'localhost' IDENTIFIED BY 'sterk-wachtwoord';
-- GRANT SELECT, INSERT, UPDATE, DELETE ON boodschap.* TO 'boodschap'@'localhost';
-- CREATE USER 'boodschap'@'192.168.1.32' IDENTIFIED BY 'sterk-wachtwoord';
-- GRANT SELECT, INSERT, UPDATE, DELETE ON boodschap.* TO 'boodschap'@'192.168.1.32';
-- CREATE USER 'boodschap'@'192.168.1.%' IDENTIFIED BY 'sterk-wachtwoord';
-- GRANT SELECT, INSERT, UPDATE, DELETE ON boodschap.* TO 'boodschap'@'192.168.1.%';
-- FLUSH PRIVILEGES;
