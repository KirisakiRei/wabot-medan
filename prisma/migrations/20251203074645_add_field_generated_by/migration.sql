-- AlterTable
ALTER TABLE `question_banks` ADD COLUMN `generated_by` ENUM('AI', 'human') NOT NULL DEFAULT 'human';

-- AlterTable
ALTER TABLE `request_banks` ADD COLUMN `generated_by` ENUM('AI', 'human') NOT NULL DEFAULT 'human';
