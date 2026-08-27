SET NAMES utf8mb4;
USE `skylia_user`;

CREATE TABLE IF NOT EXISTS `paid_invite_codes` (
  `id` bigint unsigned NOT NULL AUTO_INCREMENT,
  `code_bidx` char(64) COLLATE utf8mb4_unicode_ci NOT NULL COMMENT '邀请码 HMAC blind index，不保存明文',
  `phone_bidx` char(64) COLLATE utf8mb4_unicode_ci NOT NULL COMMENT '购买手机号 blind index',
  `phone_mask` varchar(32) COLLATE utf8mb4_unicode_ci NOT NULL COMMENT '脱敏手机号',
  `payment_reference` varchar(80) COLLATE utf8mb4_unicode_ci DEFAULT NULL COMMENT '支付或模拟付款流水号',
  `status` varchar(16) COLLATE utf8mb4_unicode_ci NOT NULL DEFAULT 'unused',
  `used_by_user_id` bigint unsigned DEFAULT NULL,
  `issued_at` datetime(3) NOT NULL,
  `expires_at` datetime(3) NOT NULL,
  `used_at` datetime(3) DEFAULT NULL,
  `created_at` datetime(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  `updated_at` datetime(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3) ON UPDATE CURRENT_TIMESTAMP(3),
  PRIMARY KEY (`id`),
  UNIQUE KEY `uk_paid_invite_code_bidx` (`code_bidx`),
  KEY `idx_paid_invite_phone_issued` (`phone_bidx`,`issued_at`),
  KEY `idx_paid_invite_status_expires` (`status`,`expires_at`),
  KEY `idx_paid_invite_used_by` (`used_by_user_id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci COMMENT='付费一次性邀请码';

