ALTER TABLE `node_contents` ADD COLUMN `cards` text;
UPDATE `node_contents` SET `cards` = '[]' WHERE `cards` IS NULL;
