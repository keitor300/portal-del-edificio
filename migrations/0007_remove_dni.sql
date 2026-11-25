-- The portal no longer collects national identity numbers. Remove any values
-- created by earlier versions while keeping the nullable column compatible
-- with already-deployed databases.
UPDATE users SET dni = NULL WHERE dni IS NOT NULL;
