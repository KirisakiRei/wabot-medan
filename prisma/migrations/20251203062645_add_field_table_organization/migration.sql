-- AlterTable
ALTER TABLE `chat_without_answers` MODIFY `chat_type` VARCHAR(255) NOT NULL DEFAULT 'sistem-informasi';

-- AlterTable
ALTER TABLE `organizations` ADD COLUMN `description` TEXT NULL;
