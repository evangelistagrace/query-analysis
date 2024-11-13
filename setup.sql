-- Create the database
DROP DATABASE IF EXISTS demo;
CREATE DATABASE demo;
USE demo;

SET SQL_SAFE_UPDATES = 0;

-- Create tables
CREATE TABLE User (
    id INT AUTO_INCREMENT PRIMARY KEY,
    email VARCHAR(255) UNIQUE NOT NULL,
    name VARCHAR(255) NOT NULL,
    score INT DEFAULT 0,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
) ENGINE=InnoDB;

CREATE TABLE Product (
    id INT AUTO_INCREMENT PRIMARY KEY,
    name VARCHAR(255) NOT NULL,
    category VARCHAR(100) NOT NULL,
    price DECIMAL(10,2) NOT NULL,
    stock INT DEFAULT 0,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
) ENGINE=InnoDB;

CREATE TABLE `Order` (
    id INT AUTO_INCREMENT PRIMARY KEY,
    user_id INT,
    total_amount DECIMAL(10,2) NOT NULL,
    status VARCHAR(50) DEFAULT 'pending',
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (user_id) REFERENCES User(id)
) ENGINE=InnoDB;

CREATE TABLE OrderItem (
    id INT AUTO_INCREMENT PRIMARY KEY,
    order_id INT,
    product_id INT,
    quantity INT NOT NULL,
    unit_price DECIMAL(10,2) NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (order_id) REFERENCES `Order`(id),
    FOREIGN KEY (product_id) REFERENCES Product(id)
) ENGINE=InnoDB;

-- Insert sample data

-- User data - Insert 1000 users
INSERT INTO User (email, name, score)
SELECT 
    CONCAT('user', n, '@example.com'),
    CONCAT('User ', n),
    FLOOR(RAND() * 100)
FROM (
    SELECT a.N + b.N * 10 + c.N * 100 + 1 N
    FROM (SELECT 0 AS N UNION SELECT 1 UNION SELECT 2 UNION SELECT 3 UNION SELECT 4 UNION SELECT 5 UNION SELECT 6 UNION SELECT 7 UNION SELECT 8 UNION SELECT 9) a,
         (SELECT 0 AS N UNION SELECT 1 UNION SELECT 2 UNION SELECT 3 UNION SELECT 4 UNION SELECT 5 UNION SELECT 6 UNION SELECT 7 UNION SELECT 8 UNION SELECT 9) b,
         (SELECT 0 AS N) c
) t
WHERE n <= 1000;

-- Product data - Insert 100 products
INSERT INTO Product (name, category, price, stock)
SELECT 
    CONCAT('Product ', n),
    CONCAT('Category ', FLOOR(RAND() * 5) + 1),
    TRUNCATE(RAND() * 1000, 2),
    FLOOR(RAND() * 1000)
FROM (
    SELECT a.N + b.N * 10 + 1 N
    FROM (SELECT 0 AS N UNION SELECT 1 UNION SELECT 2 UNION SELECT 3 UNION SELECT 4 UNION SELECT 5 UNION SELECT 6 UNION SELECT 7 UNION SELECT 8 UNION SELECT 9) a,
         (SELECT 0 AS N UNION SELECT 1 UNION SELECT 2 UNION SELECT 3 UNION SELECT 4 UNION SELECT 5 UNION SELECT 6 UNION SELECT 7 UNION SELECT 8 UNION SELECT 9) b
) t
WHERE n <= 100;

-- Create temporary table with valid user IDs
CREATE TEMPORARY TABLE temp_user_ids AS
SELECT id FROM User;

-- Insert orders using only valid user IDs
INSERT INTO `Order` (user_id, total_amount, status)
SELECT 
    (SELECT id FROM temp_user_ids ORDER BY RAND() LIMIT 1),
    0,
    ELT(FLOOR(RAND() * 4) + 1, 'pending', 'processing', 'completed', 'cancelled')
FROM (
    SELECT a.N + b.N * 10 + c.N * 100 + 1 N
    FROM (SELECT 0 AS N UNION SELECT 1 UNION SELECT 2 UNION SELECT 3 UNION SELECT 4 UNION SELECT 5 UNION SELECT 6 UNION SELECT 7 UNION SELECT 8 UNION SELECT 9) a,
         (SELECT 0 AS N UNION SELECT 1 UNION SELECT 2 UNION SELECT 3 UNION SELECT 4 UNION SELECT 5 UNION SELECT 6 UNION SELECT 7 UNION SELECT 8 UNION SELECT 9) b,
         (SELECT 0 AS N UNION SELECT 1 UNION SELECT 2 UNION SELECT 3 UNION SELECT 4) c
) t
WHERE n <= 5000;

DROP TEMPORARY TABLE temp_user_ids;

-- Order items data - Insert items for orders
INSERT INTO OrderItem (order_id, product_id, quantity, unit_price)
SELECT 
    o.id,
    p.id,
    FLOOR(RAND() * 5) + 1,
    p.price
FROM `Order` o
CROSS JOIN (
    SELECT id, price 
    FROM Product 
    WHERE id <= 100
    ORDER BY RAND()
    LIMIT 1
) p
WHERE RAND() < 0.3
LIMIT 15000;

-- Update order totals
UPDATE `Order` o 
SET total_amount = (
    SELECT COALESCE(SUM(quantity * unit_price), 0)
    FROM OrderItem
    WHERE order_id = o.id
);

-- Add some randomized dates within the last year
UPDATE `Order` 
SET created_at = DATE_SUB(NOW(), INTERVAL FLOOR(RAND() * 365) DAY);

UPDATE OrderItem oi
INNER JOIN `Order` o ON oi.order_id = o.id
SET oi.created_at = o.created_at;

-- Create indexes
CREATE INDEX idx_order_user_id ON `Order`(user_id);
CREATE INDEX idx_orderitem_order_id ON OrderItem(order_id);
CREATE INDEX idx_orderitem_product_id ON OrderItem(product_id);
CREATE INDEX idx_product_category ON Product(category);

-- Verify data
SELECT 
    (SELECT COUNT(*) FROM User) as user_count,
    (SELECT COUNT(*) FROM Product) as product_count,
    (SELECT COUNT(*) FROM `Order`) as order_count,
    (SELECT COUNT(*) FROM OrderItem) as order_items_count;

-- Sample queries to test data
-- 1. Top 5 users by order amount
SELECT 
    u.name,
    COUNT(o.id) as order_count,
    SUM(o.total_amount) as total_spent
FROM User u
JOIN `Order` o ON u.id = o.user_id
GROUP BY u.id, u.name
ORDER BY total_spent DESC
LIMIT 5;

-- 2. Product categories by sales
SELECT 
    p.category,
    COUNT(DISTINCT o.id) as order_count,
    SUM(oi.quantity) as total_items_sold,
    SUM(oi.quantity * oi.unit_price) as total_revenue
FROM Product p
JOIN OrderItem oi ON p.id = oi.product_id
JOIN `Order` o ON oi.order_id = o.id
GROUP BY p.category
ORDER BY total_revenue DESC;