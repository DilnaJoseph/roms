-- ROMS — orders + order_items (CS03_07 / Appendix A: order_id UUID, tracking_token 64-char hex)
-- CreateTable
CREATE TABLE `orders` (
    `order_id` VARCHAR(191) NOT NULL,
    `tracking_token` VARCHAR(64) NOT NULL,
    `order_status` ENUM('received', 'preparing', 'ready', 'completed') NOT NULL DEFAULT 'received',
    `order_total` DECIMAL(10, 2) NOT NULL,
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    UNIQUE INDEX `orders_tracking_token_key`(`tracking_token`),
    PRIMARY KEY (`order_id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `order_items` (
    `order_id` VARCHAR(191) NOT NULL,
    `menu_item_id` VARCHAR(64) NOT NULL,
    `name` VARCHAR(120) NOT NULL,
    `quantity` INTEGER NOT NULL,
    `unit_price` DECIMAL(8, 2) NOT NULL,

    PRIMARY KEY (`order_id`, `menu_item_id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- AddForeignKey
ALTER TABLE `order_items` ADD CONSTRAINT `order_items_order_id_fkey` FOREIGN KEY (`order_id`) REFERENCES `orders`(`order_id`) ON DELETE CASCADE ON UPDATE CASCADE;
