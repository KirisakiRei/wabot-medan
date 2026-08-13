-- CreateTable
CREATE TABLE `conversation_summaries` (
    `id` CHAR(36) NOT NULL,
    `session_key` VARCHAR(255) NOT NULL,
    `summary` JSON NOT NULL,
    `message_count` INTEGER NOT NULL DEFAULT 0,
    `last_activity_at` TIMESTAMP(0) NOT NULL DEFAULT CURRENT_TIMESTAMP(0),
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updated_at` DATETIME(3) NOT NULL,

    UNIQUE INDEX `conversation_summaries_session_key_key`(`session_key`),
    INDEX `conversation_summaries_session_key_index`(`session_key`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
