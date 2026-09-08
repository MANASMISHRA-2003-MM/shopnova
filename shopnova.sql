CREATE DATABASE IF NOT EXISTS shopnova CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
USE shopnova;

CREATE TABLE IF NOT EXISTS customers(
 id INT AUTO_INCREMENT PRIMARY KEY,
 name VARCHAR(120) NOT NULL,
 phone VARCHAR(20) NOT NULL UNIQUE,
 email VARCHAR(160),
 password_hash VARCHAR(255) NOT NULL,
 created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS products(
 id INT AUTO_INCREMENT PRIMARY KEY,
 name VARCHAR(120) NOT NULL,
 category VARCHAR(80) NOT NULL,
 unit VARCHAR(40) NOT NULL,
 price DECIMAL(10,2) NOT NULL,
 mrp DECIMAL(10,2) NOT NULL,
 stock INT NOT NULL DEFAULT 0,
 emoji VARCHAR(20) DEFAULT '🛒',
 active TINYINT(1) DEFAULT 1,
 created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS orders(
 id INT AUTO_INCREMENT PRIMARY KEY,
 customer_name VARCHAR(120) NOT NULL,
 phone VARCHAR(20) NOT NULL,
 email VARCHAR(160),
 address TEXT NOT NULL,
 latitude DECIMAL(10,7),
 longitude DECIMAL(10,7),
 payment_method VARCHAR(40) DEFAULT 'COD',
 total DECIMAL(10,2) NOT NULL,
 status VARCHAR(30) DEFAULT 'PLACED',
 created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS order_items(
 id INT AUTO_INCREMENT PRIMARY KEY,
 order_id INT NOT NULL,
 product_id INT NOT NULL,
 product_name VARCHAR(120) NOT NULL,
 qty INT NOT NULL,
 price DECIMAL(10,2) NOT NULL,
 FOREIGN KEY(order_id) REFERENCES orders(id) ON DELETE CASCADE,
 FOREIGN KEY(product_id) REFERENCES products(id)
);

INSERT INTO products(name,category,unit,price,mrp,stock,emoji) VALUES
('Potato','Fresh Vegetables','1 kg',35,42,60,'🥔'),
('Onion','Fresh Vegetables','1 kg',40,48,55,'🧅'),
('Tomato','Fresh Vegetables','1 kg',45,55,50,'🍅'),
('Carrot','Fresh Vegetables','1 kg',55,65,45,'🥕'),
('Cabbage','Fresh Vegetables','1 pc',30,38,35,'🥬'),
('Cauliflower','Fresh Vegetables','1 pc',45,55,30,'🥦'),
('Spinach','Fresh Vegetables','250 g',25,30,40,'🌿'),
('Capsicum','Fresh Vegetables','500 g',50,60,35,'🫑'),
('Banana','Fresh Fruits','1 dozen',60,75,35,'🍌'),
('Apple','Fresh Fruits','1 kg',160,190,25,'🍎'),
('Milk','Dairy & Essentials','1 litre',58,62,40,'🥛'),
('Bread','Bakery & Essentials','1 pack',45,50,30,'🍞'),
('Rice','Grocery Essentials','5 kg',320,360,25,'🍚'),
('Wheat Flour','Grocery Essentials','5 kg',260,290,30,'🌾'),
('Sugar','Grocery Essentials','1 kg',48,55,45,'🧂'),
('Cooking Oil','Grocery Essentials','1 litre',145,165,35,'🫗')
ON DUPLICATE KEY UPDATE name=VALUES(name);
