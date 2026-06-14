-- Demo seed data. Passwords for all users below = "password123"
-- (hash generated with bcrypt, 10 rounds)
USE splitwise_clone;

INSERT INTO users (name, email, password_hash) VALUES
('Alice', 'alice@example.com', '$2b$10$wH8z1Y0e1q3m8r7Z2p9bHe1jvJk8b9y1x9b1c0Z8c8j8u8u8u8u8u'),
('Bob', 'bob@example.com', '$2b$10$wH8z1Y0e1q3m8r7Z2p9bHe1jvJk8b9y1x9b1c0Z8c8j8u8u8u8u8u'),
('Charlie', 'charlie@example.com', '$2b$10$wH8z1Y0e1q3m8r7Z2p9bHe1jvJk8b9y1x9b1c0Z8c8j8u8u8u8u8u');

-- NOTE: replace the password_hash values above by running:
--   node src/utils/hashPassword.js password123
-- and pasting the output, OR simply sign up fresh users via the UI (recommended).
