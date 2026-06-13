-- Create users table
CREATE TABLE IF NOT EXISTS users (
  id                    INT AUTO_INCREMENT PRIMARY KEY,
  username              VARCHAR(64) UNIQUE NOT NULL,
  password_hash         VARCHAR(255) NOT NULL,
  role                  ENUM('admin','user') NOT NULL DEFAULT 'user',
  force_password_change BOOLEAN NOT NULL DEFAULT FALSE,
  created_at            TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Create entries table
CREATE TABLE IF NOT EXISTS entries (
  id          INT AUTO_INCREMENT PRIMARY KEY,
  user_id     INT NOT NULL,
  amount      DECIMAL(12,2) NOT NULL,
  description VARCHAR(255),
  entry_date  DATE NOT NULL,
  created_at  TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);
