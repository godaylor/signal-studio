-- Preserve the historical user ID and ownership, but invalidate only the known
-- upstream bootstrap credential. An operator explicitly runs admin:bootstrap.
UPDATE "user"
SET password = repeat('!', 60), session_version = session_version + 1
WHERE user_id = '41e2b680-648e-4b09-bcd7-3e2b10c06264'::uuid
  AND username = 'admin'
  AND password = '$2b$10$BUli0c.muyCW1ErNJc3jL.vFRFtFJWrT8/GcR4A.sUdCznaXiqFXa';
