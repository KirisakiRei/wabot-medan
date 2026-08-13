-- CreateTable
CREATE TABLE `organizations` (
    `id` VARCHAR(191) NOT NULL,
    `name` VARCHAR(300) NOT NULL,
    `is_active` TINYINT NOT NULL DEFAULT 1,
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updated_at` DATETIME(3) NOT NULL,
    `deleted_at` DATETIME(3) NULL,

    UNIQUE INDEX `organizations_name_key`(`name`),
    INDEX `organizations_is_active_index`(`is_active`),
    FULLTEXT INDEX `organizations_name_fulltext_index`(`name`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `question_categories` (
    `id` VARCHAR(191) NOT NULL,
    `name` VARCHAR(300) NOT NULL,
    `is_active` TINYINT NOT NULL DEFAULT 1,
    `order` INTEGER UNSIGNED NOT NULL DEFAULT 1,
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updated_at` DATETIME(3) NOT NULL,
    `deleted_at` DATETIME(3) NULL,

    INDEX `question_categories_is_active_index`(`is_active`),
    INDEX `question_categories_order_index`(`order`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `question_banks` (
    `id` VARCHAR(191) NOT NULL,
    `organization_id` VARCHAR(191) NOT NULL,
    `category_id` VARCHAR(191) NOT NULL,
    `question` TEXT NOT NULL,
    `order` INTEGER UNSIGNED NOT NULL DEFAULT 1,
    `status` ENUM('waiting', 'approved', 'rejected') NOT NULL DEFAULT 'waiting',
    `is_active` TINYINT NOT NULL DEFAULT 1,
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updated_at` DATETIME(3) NOT NULL,
    `deleted_at` DATETIME(3) NULL,

    INDEX `question_banks_is_active_index`(`is_active`),
    INDEX `question_banks_status_index`(`status`),
    FULLTEXT INDEX `question_banks_question_fulltext_index`(`question`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `question_rags` (
    `id` CHAR(36) NOT NULL,
    `question_id` CHAR(36) NOT NULL,
    `question_rag` TEXT NOT NULL,
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updated_at` DATETIME(3) NOT NULL,
    `deleted_at` DATETIME(3) NULL,

    INDEX `question_rags_deleted_at_index`(`deleted_at`),
    INDEX `question_rags_question_id_index`(`question_id`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `question_answers` (
    `id` CHAR(36) NOT NULL,
    `question_id` CHAR(36) NOT NULL,
    `answer_type` ENUM('text', 'image', 'video', 'document', 'audio', 'location') NOT NULL DEFAULT 'text',
    `answer` JSON NOT NULL,
    `order` INTEGER UNSIGNED NOT NULL DEFAULT 1,
    `is_active` TINYINT NOT NULL DEFAULT 1,
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updated_at` DATETIME(3) NOT NULL,
    `deleted_at` DATETIME(3) NULL,

    INDEX `question_answers_deleted_at_index`(`deleted_at`),
    INDEX `question_answers_is_active_index`(`is_active`),
    INDEX `question_answers_order_index`(`order`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `question_sugestions` (
    `id` CHAR(36) NOT NULL,
    `question_base_id` CHAR(36) NOT NULL,
    `question_sugestion_id` CHAR(36) NOT NULL,
    `order` INTEGER UNSIGNED NOT NULL DEFAULT 1,
    `is_active` TINYINT NOT NULL DEFAULT 1,
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updated_at` DATETIME(3) NOT NULL,
    `deleted_at` DATETIME(3) NULL,

    INDEX `question_sugestions_is_active_index`(`is_active`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `chat_lists` (
    `id` VARCHAR(191) NOT NULL,
    `year` YEAR NOT NULL,
    `account_name` VARCHAR(255) NULL,
    `phone_number` VARCHAR(255) NOT NULL,
    `status` ENUM('ongoing', 'finished') NOT NULL DEFAULT 'ongoing',
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updated_at` DATETIME(3) NOT NULL,
    `deleted_at` DATETIME(3) NULL,

    UNIQUE INDEX `chat_lists_phone_number_key`(`phone_number`),
    INDEX `chat_lists_phone_number_index`(`phone_number`),
    INDEX `chat_lists_status_index`(`status`),
    INDEX `chat_lists_year_index`(`year`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `blocked_chat_list_histories` (
    `id` VARCHAR(191) NOT NULL,
    `chat_list_id` CHAR(36) NOT NULL,
    `reason` TEXT NULL,
    `blocked_expired_at` DATETIME(3) NULL,
    `blocked_status` ENUM('temporary', 'permanent') NOT NULL DEFAULT 'temporary',
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updated_at` DATETIME(3) NOT NULL,
    `deleted_at` DATETIME(3) NULL,

    INDEX `blocked_chat_lists_chat_list_id_index`(`chat_list_id`),
    INDEX `blocked_chat_lists_created_at_index`(`created_at`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `chat_logs` (
    `id` VARCHAR(191) NOT NULL,
    `year` YEAR NOT NULL,
    `chat_id` VARCHAR(191) NOT NULL,
    `message` TEXT NULL,
    `bot_reply` TEXT NULL,
    `chat_room` VARCHAR(255) NULL,
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updated_at` DATETIME(3) NOT NULL,
    `deleted_at` DATETIME(3) NULL,

    INDEX `chat_logs_chat_id_index`(`chat_id`),
    INDEX `chat_logs_year_index`(`year`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `answered_chats` (
    `id` CHAR(36) NOT NULL,
    `year` YEAR NOT NULL,
    `chat_log_id` CHAR(36) NOT NULL,
    `question_base_id` CHAR(36) NOT NULL,
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updated_at` DATETIME(3) NOT NULL,
    `deleted_at` DATETIME(3) NULL,

    INDEX `answered_chats_chat_log_id_index`(`chat_log_id`),
    INDEX `answered_chats_deleted_at_index`(`deleted_at`),
    INDEX `answered_chats_question_base_id_index`(`question_base_id`),
    INDEX `answered_chats_year_index`(`year`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `chat_without_answers` (
    `id` VARCHAR(191) NOT NULL,
    `organization_id` CHAR(36) NULL,
    `category_id` CHAR(36) NULL,
    `year` YEAR NOT NULL,
    `chat_log_id` VARCHAR(191) NOT NULL,
    `chat_room` VARCHAR(255) NOT NULL,
    `status` ENUM('unverified', 'verified') NOT NULL DEFAULT 'unverified',
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updated_at` DATETIME(3) NOT NULL,
    `deleted_at` DATETIME(3) NULL,

    INDEX `chat_without_answers_chat_log_id_index`(`chat_log_id`),
    INDEX `chat_without_answers_deleted_at_index`(`deleted_at`),
    INDEX `chat_without_answers_year_index`(`year`),
    INDEX `chat_without_answers_status_index`(`status`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `chatting_experience_rates` (
    `id` CHAR(36) NOT NULL,
    `rate` TINYINT UNSIGNED NOT NULL,
    `chat_room` VARCHAR(255) NOT NULL,
    `created_at` TIMESTAMP(0) NULL,
    `updated_at` TIMESTAMP(0) NULL,
    `deleted_at` TIMESTAMP(0) NULL,

    INDEX `chatting_experience_rates_deleted_at_index`(`deleted_at`),
    INDEX `chatting_experience_rates_rate_index`(`rate`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `variables` (
    `id` CHAR(36) NOT NULL,
    `name` VARCHAR(255) NULL,
    `content` TEXT NULL,
    `created_at` TIMESTAMP(0) NULL,
    `updated_at` TIMESTAMP(0) NULL,
    `deleted_at` TIMESTAMP(0) NULL,

    INDEX `variables_deleted_at_index`(`deleted_at`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `greetings` (
    `id` CHAR(36) NOT NULL,
    `keyword` VARCHAR(255) NOT NULL,
    `response` TEXT NULL,
    `created_at` TIMESTAMP(0) NULL,
    `updated_at` TIMESTAMP(0) NULL,
    `deleted_at` TIMESTAMP(0) NULL,

    INDEX `greetings_deleted_at_index`(`deleted_at`),
    INDEX `greetings_keyword_index`(`keyword`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `word_filters` (
    `id` CHAR(36) NOT NULL,
    `word` VARCHAR(255) NULL,
    `created_at` TIMESTAMP(0) NULL,
    `updated_at` TIMESTAMP(0) NULL,
    `deleted_at` TIMESTAMP(0) NULL,

    INDEX `word_filters_deleted_at_index`(`deleted_at`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `footer_chats` (
    `id` CHAR(36) NOT NULL,
    `content` TEXT NULL,
    `created_at` TIMESTAMP(0) NULL,
    `updated_at` TIMESTAMP(0) NULL,
    `deleted_at` TIMESTAMP(0) NULL,

    INDEX `footer_chats_deleted_at_index`(`deleted_at`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `activity_log` (
    `id` CHAR(36) NOT NULL,
    `log_name` VARCHAR(255) NULL,
    `description` TEXT NOT NULL,
    `subject_type` VARCHAR(255) NULL,
    `event` VARCHAR(255) NULL,
    `subject_id` CHAR(36) NULL,
    `causer_type` VARCHAR(255) NULL,
    `causer_id` CHAR(36) NULL,
    `properties` JSON NULL,
    `batch_uuid` CHAR(36) NULL,
    `created_at` TIMESTAMP(0) NULL,
    `updated_at` TIMESTAMP(0) NULL,

    INDEX `activity_log_log_name_index`(`log_name`),
    INDEX `causer`(`causer_type`, `causer_id`),
    INDEX `subject`(`subject_type`, `subject_id`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `cache` (
    `key` VARCHAR(255) NOT NULL,
    `value` MEDIUMTEXT NOT NULL,
    `expiration` INTEGER NOT NULL,

    PRIMARY KEY (`key`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `cache_locks` (
    `key` VARCHAR(255) NOT NULL,
    `owner` VARCHAR(255) NOT NULL,
    `expiration` INTEGER NOT NULL,

    PRIMARY KEY (`key`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `expired_bot_configs` (
    `id` CHAR(36) NOT NULL,
    `message` TEXT NULL,
    `duration` VARCHAR(255) NULL,
    `created_at` TIMESTAMP(0) NULL,
    `updated_at` TIMESTAMP(0) NULL,
    `deleted_at` TIMESTAMP(0) NULL,

    INDEX `expired_bot_configs_deleted_at_index`(`deleted_at`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `failed_jobs` (
    `id` BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
    `uuid` VARCHAR(255) NOT NULL,
    `connection` TEXT NOT NULL,
    `queue` TEXT NOT NULL,
    `payload` LONGTEXT NOT NULL,
    `exception` LONGTEXT NOT NULL,
    `failed_at` TIMESTAMP(0) NOT NULL DEFAULT CURRENT_TIMESTAMP(0),

    UNIQUE INDEX `failed_jobs_uuid_unique`(`uuid`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `job_batches` (
    `id` VARCHAR(255) NOT NULL,
    `name` VARCHAR(255) NOT NULL,
    `total_jobs` INTEGER NOT NULL,
    `pending_jobs` INTEGER NOT NULL,
    `failed_jobs` INTEGER NOT NULL,
    `failed_job_ids` LONGTEXT NOT NULL,
    `options` MEDIUMTEXT NULL,
    `cancelled_at` INTEGER NULL,
    `created_at` INTEGER NOT NULL,
    `finished_at` INTEGER NULL,

    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `jobs` (
    `id` BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
    `queue` VARCHAR(255) NOT NULL,
    `payload` LONGTEXT NOT NULL,
    `attempts` TINYINT UNSIGNED NOT NULL,
    `reserved_at` INTEGER UNSIGNED NULL,
    `available_at` INTEGER UNSIGNED NOT NULL,
    `created_at` INTEGER UNSIGNED NOT NULL,

    INDEX `jobs_queue_index`(`queue`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `migrations` (
    `id` INTEGER UNSIGNED NOT NULL AUTO_INCREMENT,
    `migration` VARCHAR(255) NOT NULL,
    `batch` INTEGER NOT NULL,

    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `model_has_permissions` (
    `permission_id` CHAR(36) NOT NULL,
    `model_type` VARCHAR(255) NOT NULL,
    `model_id` CHAR(36) NOT NULL,

    INDEX `model_has_permissions_model_id_model_type_index`(`model_id`, `model_type`),
    PRIMARY KEY (`permission_id`, `model_id`, `model_type`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `model_has_roles` (
    `role_id` CHAR(36) NOT NULL,
    `model_type` VARCHAR(255) NOT NULL,
    `model_id` CHAR(36) NOT NULL,

    INDEX `model_has_roles_model_id_model_type_index`(`model_id`, `model_type`),
    PRIMARY KEY (`role_id`, `model_id`, `model_type`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `password_reset_tokens` (
    `email` VARCHAR(255) NOT NULL,
    `token` VARCHAR(255) NOT NULL,
    `created_at` TIMESTAMP(0) NULL,

    PRIMARY KEY (`email`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `permissions` (
    `id` CHAR(36) NOT NULL,
    `name` VARCHAR(255) NOT NULL,
    `guard_name` VARCHAR(255) NOT NULL,
    `created_at` TIMESTAMP(0) NULL,
    `updated_at` TIMESTAMP(0) NULL,

    INDEX `permissions_name_guard_name_index`(`name`, `guard_name`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `personal_access_tokens` (
    `id` CHAR(36) NOT NULL,
    `tokenable_type` VARCHAR(255) NOT NULL,
    `tokenable_id` CHAR(36) NOT NULL,
    `name` VARCHAR(255) NOT NULL,
    `token` VARCHAR(64) NOT NULL,
    `abilities` TEXT NULL,
    `last_used_at` TIMESTAMP(0) NULL,
    `expires_at` TIMESTAMP(0) NULL,
    `created_at` TIMESTAMP(0) NULL,
    `updated_at` TIMESTAMP(0) NULL,

    UNIQUE INDEX `personal_access_tokens_token_unique`(`token`),
    INDEX `personal_access_tokens_tokenable_type_tokenable_id_index`(`tokenable_type`, `tokenable_id`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `prompts` (
    `id` CHAR(36) NOT NULL,
    `prompt` TEXT NULL,
    `created_at` TIMESTAMP(0) NULL,
    `updated_at` TIMESTAMP(0) NULL,
    `deleted_at` TIMESTAMP(0) NULL,

    INDEX `prompts_deleted_at_index`(`deleted_at`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `request_banks` (
    `id` CHAR(36) NOT NULL,
    `organization_id` CHAR(36) NULL,
    `category_id` CHAR(36) NOT NULL,
    `request_name` TEXT NULL,
    `order` INTEGER UNSIGNED NOT NULL DEFAULT 1,
    `is_active` BOOLEAN NOT NULL DEFAULT true,
    `status` ENUM('waiting', 'approved', 'rejected') NOT NULL DEFAULT 'waiting',
    `keyword_submit` VARCHAR(255) NOT NULL,
    `created_at` TIMESTAMP(0) NULL,
    `updated_at` TIMESTAMP(0) NULL,
    `deleted_at` TIMESTAMP(0) NULL,

    INDEX `request_banks_is_active_index`(`is_active`),
    INDEX `request_banks_status_index`(`status`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `request_rags` (
    `id` CHAR(36) NOT NULL,
    `request_id` CHAR(36) NOT NULL,
    `request_rag` TEXT NOT NULL,
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updated_at` DATETIME(3) NOT NULL,
    `deleted_at` DATETIME(3) NULL,

    INDEX `request_rags_deleted_at_index`(`deleted_at`),
    INDEX `request_rags_request_id_index`(`request_id`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `request_categories` (
    `id` CHAR(36) NOT NULL,
    `name` VARCHAR(255) NOT NULL,
    `is_active` BOOLEAN NOT NULL DEFAULT true,
    `order` INTEGER UNSIGNED NOT NULL DEFAULT 1,
    `created_at` TIMESTAMP(0) NULL,
    `updated_at` TIMESTAMP(0) NULL,
    `deleted_at` TIMESTAMP(0) NULL,

    INDEX `request_categories_is_active_index`(`is_active`),
    INDEX `request_categories_order_index`(`order`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `request_forms` (
    `id` CHAR(36) NOT NULL,
    `request_id` CHAR(36) NULL,
    `form` TEXT NULL,
    `type` ENUM('text', 'file') NOT NULL DEFAULT 'text',
    `order` INTEGER UNSIGNED NOT NULL DEFAULT 1,
    `is_active` BOOLEAN NOT NULL DEFAULT true,
    `created_at` TIMESTAMP(0) NULL,
    `updated_at` TIMESTAMP(0) NULL,
    `deleted_at` TIMESTAMP(0) NULL,

    INDEX `request_forms_deleted_at_index`(`deleted_at`),
    INDEX `request_forms_is_active_index`(`is_active`),
    INDEX `request_forms_order_index`(`order`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `request_history_details` (
    `request_history_id` CHAR(36) NOT NULL,
    `request_form_id` CHAR(36) NOT NULL,
    `value` TEXT NULL,
    `type` ENUM('text', 'file') NOT NULL DEFAULT 'text',
    `created_at` DATETIME(3) NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updated_at` TIMESTAMP(0) NULL,
    `deleted_at` TIMESTAMP(0) NULL,

    PRIMARY KEY (`request_history_id`, `request_form_id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `request_histories` (
    `id` CHAR(36) NOT NULL,
    `request_id` CHAR(36) NOT NULL,
    `submit_response` TEXT NULL,
    `status` ENUM('waiting', 'approved', 'rejected') NOT NULL DEFAULT 'waiting',
    `sender` VARCHAR(255) NULL,
    `created_at` DATETIME(3) NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updated_at` TIMESTAMP(0) NULL,
    `deleted_at` TIMESTAMP(0) NULL,

    INDEX `request_histories_deleted_at_index`(`deleted_at`),
    INDEX `request_histories_status_index`(`status`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `role_has_permissions` (
    `permission_id` CHAR(36) NOT NULL,
    `role_id` CHAR(36) NOT NULL,

    INDEX `role_has_permissions_role_id_foreign`(`role_id`),
    PRIMARY KEY (`permission_id`, `role_id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `roles` (
    `id` CHAR(36) NOT NULL,
    `name` VARCHAR(255) NOT NULL,
    `guard_name` VARCHAR(255) NOT NULL,
    `created_at` TIMESTAMP(0) NULL,
    `updated_at` TIMESTAMP(0) NULL,
    `deleted_at` TIMESTAMP(0) NULL,

    INDEX `roles_deleted_at_index`(`deleted_at`),
    INDEX `roles_name_guard_name_index`(`name`, `guard_name`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `service_schedules` (
    `id` CHAR(36) NOT NULL,
    `day` VARCHAR(255) NOT NULL,
    `day_number` TINYINT UNSIGNED NOT NULL,
    `start_time` TIME(0) NULL,
    `end_time` TIME(0) NULL,
    `created_at` TIMESTAMP(0) NULL,
    `updated_at` TIMESTAMP(0) NULL,
    `deleted_at` TIMESTAMP(0) NULL,

    INDEX `service_schedules_deleted_at_index`(`deleted_at`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `sessions` (
    `id` VARCHAR(255) NOT NULL,
    `user_id` BIGINT UNSIGNED NULL,
    `ip_address` VARCHAR(45) NULL,
    `user_agent` TEXT NULL,
    `payload` LONGTEXT NOT NULL,
    `last_activity` INTEGER NOT NULL,

    INDEX `sessions_last_activity_index`(`last_activity`),
    INDEX `sessions_user_id_index`(`user_id`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `spam_filters` (
    `id` CHAR(36) NOT NULL,
    `phone_number` VARCHAR(255) NULL,
    `created_at` TIMESTAMP(0) NULL,
    `updated_at` TIMESTAMP(0) NULL,
    `deleted_at` TIMESTAMP(0) NULL,

    INDEX `spam_filters_deleted_at_index`(`deleted_at`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `unanswered_questions` (
    `id` CHAR(36) NOT NULL,
    `organization_id` CHAR(36) NULL,
    `category_id` CHAR(36) NOT NULL,
    `question` TEXT NULL,
    `status` ENUM('unverified', 'verified') NOT NULL DEFAULT 'unverified',
    `created_at` TIMESTAMP(0) NULL,
    `updated_at` TIMESTAMP(0) NULL,
    `deleted_at` TIMESTAMP(0) NULL,

    INDEX `unanswered_questions_status_index`(`status`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `user_organizations` (
    `user_id` CHAR(36) NOT NULL,
    `organization_id` CHAR(36) NOT NULL,
    `created_at` TIMESTAMP(0) NULL,
    `updated_at` TIMESTAMP(0) NULL,
    `deleted_at` TIMESTAMP(0) NULL,

    INDEX `user_organizations_deleted_at_index`(`deleted_at`),
    INDEX `user_organizations_user_id_organization_id_index`(`user_id`, `organization_id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `users` (
    `id` CHAR(36) NOT NULL,
    `name` VARCHAR(255) NOT NULL,
    `username` VARCHAR(255) NOT NULL,
    `is_active` BOOLEAN NOT NULL DEFAULT true,
    `password` VARCHAR(255) NOT NULL,
    `remember_token` VARCHAR(100) NULL,
    `created_at` TIMESTAMP(0) NULL,
    `updated_at` TIMESTAMP(0) NULL,
    `deleted_at` TIMESTAMP(0) NULL,

    INDEX `users_deleted_at_index`(`deleted_at`),
    INDEX `users_is_active_index`(`is_active`),
    INDEX `users_username_index`(`username`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `w_a_agents` (
    `id` CHAR(36) NOT NULL,
    `session` VARCHAR(255) NOT NULL,
    `is_active` BOOLEAN NOT NULL DEFAULT true,
    `type` ENUM('official', 'non official') NOT NULL DEFAULT 'official',
    `created_at` TIMESTAMP(0) NULL,
    `updated_at` TIMESTAMP(0) NULL,
    `deleted_at` TIMESTAMP(0) NULL,

    INDEX `w_a_agents_deleted_at_index`(`deleted_at`),
    INDEX `w_a_agents_is_active_index`(`is_active`),
    INDEX `w_a_agents_session_index`(`session`),
    INDEX `w_a_agents_type_index`(`type`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `w_a_official_quotas` (
    `id` CHAR(36) NOT NULL,
    `quota` INTEGER UNSIGNED NOT NULL DEFAULT 0,
    `created_at` TIMESTAMP(0) NULL,
    `updated_at` TIMESTAMP(0) NULL,
    `deleted_at` TIMESTAMP(0) NULL,

    INDEX `w_a_official_quotas_deleted_at_index`(`deleted_at`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `complaint_templates` (
    `id` CHAR(36) NOT NULL,
    `content` TEXT NOT NULL,
    `keyword_submit` VARCHAR(255) NOT NULL,
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updated_at` DATETIME(3) NOT NULL,
    `deleted_at` DATETIME(3) NULL,

    INDEX `complaint_templates_deleted_at_index`(`deleted_at`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `complaints` (
    `id` CHAR(36) NOT NULL,
    `code` VARCHAR(255) NOT NULL,
    `submit_response` JSON NULL,
    `status` ENUM('waiting', 'on process', 'rejected', 'completed') NOT NULL DEFAULT 'waiting',
    `sender` VARCHAR(255) NOT NULL,
    `sender_name` VARCHAR(255) NULL,
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updated_at` DATETIME(3) NOT NULL,
    `deleted_at` DATETIME(3) NULL,

    UNIQUE INDEX `complaints_code_key`(`code`),
    INDEX `complaints_code_index`(`code`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `greeting_files` (
    `id` CHAR(36) NOT NULL,
    `name` VARCHAR(255) NOT NULL,
    `file` VARCHAR(255) NOT NULL,
    `is_default` TINYINT NOT NULL,
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updated_at` DATETIME(3) NOT NULL,
    `deleted_at` DATETIME(3) NULL,

    INDEX `greeting_files_name_idx`(`name`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- AddForeignKey
ALTER TABLE `question_banks` ADD CONSTRAINT `question_banks_category_id_fkey` FOREIGN KEY (`category_id`) REFERENCES `question_categories`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `question_banks` ADD CONSTRAINT `question_banks_organization_id_fkey` FOREIGN KEY (`organization_id`) REFERENCES `organizations`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `question_rags` ADD CONSTRAINT `question_rags_question_id_fkey` FOREIGN KEY (`question_id`) REFERENCES `question_banks`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `question_answers` ADD CONSTRAINT `question_answers_question_id_fkey` FOREIGN KEY (`question_id`) REFERENCES `question_banks`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `question_sugestions` ADD CONSTRAINT `question_sugestions_question_base_id_fkey` FOREIGN KEY (`question_base_id`) REFERENCES `question_banks`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `question_sugestions` ADD CONSTRAINT `question_sugestions_question_sugestion_id_fkey` FOREIGN KEY (`question_sugestion_id`) REFERENCES `question_banks`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `blocked_chat_list_histories` ADD CONSTRAINT `blocked_chat_list_histories_chat_list_id_fkey` FOREIGN KEY (`chat_list_id`) REFERENCES `chat_lists`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `chat_logs` ADD CONSTRAINT `fk_chatlog_chatlist` FOREIGN KEY (`chat_id`) REFERENCES `chat_lists`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `answered_chats` ADD CONSTRAINT `answered_chats_chat_log_id_fkey` FOREIGN KEY (`chat_log_id`) REFERENCES `chat_logs`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `answered_chats` ADD CONSTRAINT `answered_chats_question_base_id_fkey` FOREIGN KEY (`question_base_id`) REFERENCES `question_banks`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `chat_without_answers` ADD CONSTRAINT `chat_without_answers_category_id_fkey` FOREIGN KEY (`category_id`) REFERENCES `question_categories`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `chat_without_answers` ADD CONSTRAINT `chat_without_answers_organization_id_fkey` FOREIGN KEY (`organization_id`) REFERENCES `organizations`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `chat_without_answers` ADD CONSTRAINT `chat_without_answers_chat_log_id_fkey` FOREIGN KEY (`chat_log_id`) REFERENCES `chat_logs`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `model_has_permissions` ADD CONSTRAINT `model_has_permissions_permission_id_foreign` FOREIGN KEY (`permission_id`) REFERENCES `permissions`(`id`) ON DELETE CASCADE ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE `model_has_roles` ADD CONSTRAINT `model_has_roles_role_id_foreign` FOREIGN KEY (`role_id`) REFERENCES `roles`(`id`) ON DELETE CASCADE ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE `request_banks` ADD CONSTRAINT `request_banks_organization_id_fkey` FOREIGN KEY (`organization_id`) REFERENCES `organizations`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `request_banks` ADD CONSTRAINT `request_banks_category_id_fkey` FOREIGN KEY (`category_id`) REFERENCES `request_categories`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `request_rags` ADD CONSTRAINT `request_rags_request_id_fkey` FOREIGN KEY (`request_id`) REFERENCES `request_banks`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `request_history_details` ADD CONSTRAINT `request_history_details_request_history_id_foreign` FOREIGN KEY (`request_history_id`) REFERENCES `request_histories`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `request_history_details` ADD CONSTRAINT `request_history_details_request_form_id_foreign` FOREIGN KEY (`request_form_id`) REFERENCES `request_forms`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `request_histories` ADD CONSTRAINT `request_histories_request_bank_id_foreign` FOREIGN KEY (`request_id`) REFERENCES `request_banks`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `role_has_permissions` ADD CONSTRAINT `role_has_permissions_permission_id_foreign` FOREIGN KEY (`permission_id`) REFERENCES `permissions`(`id`) ON DELETE CASCADE ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE `role_has_permissions` ADD CONSTRAINT `role_has_permissions_role_id_foreign` FOREIGN KEY (`role_id`) REFERENCES `roles`(`id`) ON DELETE CASCADE ON UPDATE NO ACTION;
