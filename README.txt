SHOPNOVA GROCERY - FIXED VERSION

1. Open PowerShell in this folder.
2. Make sure .env exists with your MySQL details, for example:
   DB_HOST=localhost
   DB_PORT=3306
   DB_USER=root
   DB_PASSWORD=YOUR_MYSQL_PASSWORD
   DB_NAME=shopnova
   PORT=5001
   ADMIN_USER=admin
   ADMIN_PASSWORD=YOUR_ADMIN_PASSWORD
3. Run: npm install
4. Run: npm start
5. Open: http://localhost:5001

IMPORTANT FIXES:
- Database tables are created automatically if missing.
- Default vegetables, fruits and grocery products are inserted automatically when the products table is empty.
- Customer login loads products from /api/products after successful login.
- Admin Add Product now reads form fields correctly (no more false "Product details incomplete" caused by browser global variable names).
- Orders save delivery address, optional current GPS coordinates, cart items and reduce stock.

If port 5001 is already in use, stop the old server with Ctrl+C or use:
netstat -ano | findstr :5001
then:
taskkill /PID <PID> /F
