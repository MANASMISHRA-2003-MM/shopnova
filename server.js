require("dotenv").config();
const express=require("express");
const mysql=require("mysql2/promise");
const cors=require("cors");
const bcrypt=require("bcryptjs");
const crypto=require("crypto");
const path=require("path");

const app=express();
app.use(cors());
app.use(express.json({limit:"1mb"}));
app.use(express.static(path.join(__dirname,"public")));

const PORT=Number(process.env.PORT||5001);
const pool=mysql.createPool({
 host:process.env.DB_HOST||"localhost",
 port:Number(process.env.DB_PORT||3306),
 user:process.env.DB_USER||"root",
 password:process.env.DB_PASSWORD||"",
 database:process.env.DB_NAME||"shopnova",
 waitForConnections:true,connectionLimit:10,queueLimit:0
});

const adminTokens=new Set();
function adminOnly(req,res,next){
 const h=req.headers.authorization||"";
 const token=h.startsWith("Bearer ")?h.slice(7):"";
 if(!adminTokens.has(token))return res.status(401).json({error:"Admin login required"});
 next();
}

async function initDatabase(){
 await pool.query(`CREATE TABLE IF NOT EXISTS customers(
   id INT AUTO_INCREMENT PRIMARY KEY,
   name VARCHAR(120) NOT NULL,
   phone VARCHAR(20) NOT NULL UNIQUE,
   email VARCHAR(160),
   password_hash VARCHAR(255) NOT NULL,
   created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
 )`);
 await pool.query(`CREATE TABLE IF NOT EXISTS products(
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
 )`);
 await pool.query(`CREATE TABLE IF NOT EXISTS orders(
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
 )`);
 await pool.query(`CREATE TABLE IF NOT EXISTS order_items(
   id INT AUTO_INCREMENT PRIMARY KEY,
   order_id INT NOT NULL,
   product_id INT NOT NULL,
   product_name VARCHAR(120) NOT NULL,
   qty INT NOT NULL,
   price DECIMAL(10,2) NOT NULL,
   FOREIGN KEY(order_id) REFERENCES orders(id) ON DELETE CASCADE,
   FOREIGN KEY(product_id) REFERENCES products(id)
 )`);

 const [[count]] = await pool.query("SELECT COUNT(*) AS total FROM products");
 if(Number(count.total)===0){
   const products=[
    ['Potato','Fresh Vegetables','1 kg',35,42,60,'🥔'],
    ['Onion','Fresh Vegetables','1 kg',40,48,55,'🧅'],
    ['Tomato','Fresh Vegetables','1 kg',45,55,50,'🍅'],
    ['Carrot','Fresh Vegetables','1 kg',55,65,45,'🥕'],
    ['Cabbage','Fresh Vegetables','1 pc',30,38,35,'🥬'],
    ['Cauliflower','Fresh Vegetables','1 pc',45,55,30,'🥦'],
    ['Spinach','Fresh Vegetables','250 g',25,30,40,'🌿'],
    ['Capsicum','Fresh Vegetables','500 g',50,60,35,'🫑'],
    ['Banana','Fresh Fruits','1 dozen',60,75,35,'🍌'],
    ['Apple','Fresh Fruits','1 kg',160,190,25,'🍎'],
    ['Milk','Dairy & Essentials','1 litre',58,62,40,'🥛'],
    ['Bread','Bakery & Essentials','1 pack',45,50,30,'🍞'],
    ['Rice','Grocery Essentials','5 kg',320,360,25,'🍚'],
    ['Wheat Flour','Grocery Essentials','5 kg',260,290,30,'🌾'],
    ['Sugar','Grocery Essentials','1 kg',48,55,45,'🧂'],
    ['Cooking Oil','Grocery Essentials','1 litre',145,165,35,'🫗']
   ];
   await pool.query("INSERT INTO products(name,category,unit,price,mrp,stock,emoji) VALUES ?",[products]);
   console.log("✅ Default grocery products seeded.");
 }
}

app.get("/api/health",async(req,res)=>{try{await pool.query("SELECT 1");res.json({ok:true,db:"connected"})}catch(e){res.status(500).json({ok:false,db:"error",message:e.message})}});

app.get("/api/products",async(req,res)=>{
 try{
  const [rows]=await pool.query("SELECT id,name,category,unit,price,mrp,stock,emoji FROM products WHERE active=1 ORDER BY category,name");
  res.json(rows);
 }catch(e){console.error("❌ Products API:",e.message);res.status(500).json({error:"Products load failed",detail:e.message})}
});

app.post("/api/register",async(req,res)=>{
 const {name,phone,email,password}=req.body;
 if(!name||!/^[0-9]{10}$/.test(phone)||!password||password.length<6)return res.status(400).json({error:"Invalid registration details"});
 try{
  const [exists]=await pool.query("SELECT id FROM customers WHERE phone=?",[phone]);
  if(exists.length)return res.status(409).json({error:"Mobile already registered"});
  const hash=await bcrypt.hash(password,10);
  const [r]=await pool.query("INSERT INTO customers(name,phone,email,password_hash) VALUES(?,?,?,?)",[name.trim(),phone,email||null,hash]);
  res.json({user:{id:r.insertId,name:name.trim(),phone,email:email||""}});
 }catch(e){res.status(500).json({error:"Registration failed",detail:e.message})}
});

app.post("/api/login",async(req,res)=>{
 const {phone,password}=req.body;
 try{
  const [rows]=await pool.query("SELECT id,name,phone,email,password_hash FROM customers WHERE phone=? LIMIT 1",[phone]);
  if(!rows.length||!(await bcrypt.compare(password,rows[0].password_hash)))return res.status(401).json({error:"Mobile ya password galat hai"});
  const u=rows[0];res.json({user:{id:u.id,name:u.name,phone:u.phone,email:u.email||""}});
 }catch(e){res.status(500).json({error:"Login failed",detail:e.message})}
});

app.post("/api/orders",async(req,res)=>{
 const {customer_name,phone,email,address,payment_method,items,location}=req.body;
 if(!customer_name||!/^[0-9]{10}$/.test(phone)||!address||!Array.isArray(items)||!items.length)return res.status(400).json({error:"Delivery details/cart incomplete"});
 const conn=await pool.getConnection();
 try{
  await conn.beginTransaction(); let total=0,clean=[];
  for(const item of items){
   const [rows]=await conn.query("SELECT id,name,price,stock FROM products WHERE id=? AND active=1 FOR UPDATE",[item.id]);
   if(!rows.length)throw Error("Product not found");
   const p=rows[0],qty=Math.max(1,Math.floor(Number(item.qty||1)));
   if(qty>p.stock)throw Error(`${p.name} stock is only ${p.stock}`);
   total+=Number(p.price)*qty;clean.push({p,qty});
  }
  const lat=location?.lat?Number(location.lat):null,lng=location?.lng?Number(location.lng):null;
  const [or]=await conn.query("INSERT INTO orders(customer_name,phone,email,address,latitude,longitude,payment_method,total,status) VALUES(?,?,?,?,?,?,?,?,?)",[customer_name,phone,email||null,address,lat,lng,payment_method||"COD",total,"PLACED"]);
  for(const x of clean){
   await conn.query("INSERT INTO order_items(order_id,product_id,product_name,qty,price) VALUES(?,?,?,?,?)",[or.insertId,x.p.id,x.p.name,x.qty,x.p.price]);
   await conn.query("UPDATE products SET stock=stock-? WHERE id=?",[x.qty,x.p.id]);
  }
  await conn.commit();res.json({success:true,order_id:or.insertId,total});
 }catch(e){await conn.rollback();res.status(400).json({error:e.message})}finally{conn.release()}
});

app.post("/api/admin/login",(req,res)=>{
 const {username,password}=req.body;
 if(username===process.env.ADMIN_USER&&password===process.env.ADMIN_PASSWORD){const token=crypto.randomBytes(24).toString("hex");adminTokens.add(token);return res.json({token});}
 res.status(401).json({error:"Invalid admin credentials"});
});

app.get("/api/admin/dashboard",adminOnly,async(req,res)=>{
 try{
  const [[p]] = await pool.query("SELECT COUNT(*) products FROM products WHERE active=1");
  const [[o]] = await pool.query("SELECT COUNT(*) orders FROM orders");
  const [[c]] = await pool.query("SELECT COUNT(*) customers FROM customers");
  const [[s]] = await pool.query("SELECT COALESCE(SUM(total),0) sales FROM orders WHERE status NOT IN ('CANCELLED')");
  const [recentOrders]=await pool.query("SELECT id,customer_name,phone,total,payment_method,status,address FROM orders ORDER BY id DESC LIMIT 30");
  res.json({products:p.products,orders:o.orders,customers:c.customers,sales:s.sales,recentOrders});
 }catch(e){res.status(500).json({error:e.message})}
});

app.post("/api/admin/products",adminOnly,async(req,res)=>{
 const {name,category,unit,price,mrp,stock,emoji}=req.body;
 const cleanPrice=Number(price),cleanMrp=Number(mrp||price),cleanStock=Number(stock||0);
 if(!String(name||"").trim()||!String(category||"").trim()||!String(unit||"").trim()||!Number.isFinite(cleanPrice)||cleanPrice<0||!Number.isFinite(cleanMrp)||cleanMrp<0||!Number.isFinite(cleanStock)||cleanStock<0)return res.status(400).json({error:"Product details incomplete"});
 try{await pool.query("INSERT INTO products(name,category,unit,price,mrp,stock,emoji) VALUES(?,?,?,?,?,?,?)",[String(name).trim(),String(category).trim(),String(unit).trim(),cleanPrice,cleanMrp,Math.floor(cleanStock),String(emoji||"🛒")]);res.json({message:"Product added"})}
 catch(e){res.status(500).json({error:e.message})}
});

app.get("*",(req,res)=>res.sendFile(path.join(__dirname,"public","index.html")));

initDatabase().then(()=>{
 app.listen(PORT,()=>console.log(`🛒 ShopNova running on http://localhost:${PORT}`));
}).catch(e=>{
 console.error("❌ Database initialization failed:",e.message);
 process.exit(1);
});
