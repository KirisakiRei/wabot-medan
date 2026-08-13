/*
  Warnings:

  - Added the required column `chat_type` to the `chat_without_answers` table without a default value. This is not possible if the table is not empty.

*/
-- AlterTable
ALTER TABLE `chat_without_answers` ADD COLUMN `chat_type` VARCHAR(255) NOT NULL;
