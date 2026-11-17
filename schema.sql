-- ShubhaVedika (శుభ వేదిక) - MySQL schema + sample data
-- Open in MySQL Workbench -> File > Open SQL Script -> run all (lightning icon)
CREATE DATABASE IF NOT EXISTS shubhavedika CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
USE shubhavedika;

DROP TABLE IF EXISTS payments, vendor_documents, reviews, enquiries, vendors, categories, cities, admins;

CREATE TABLE admins (
  id INT AUTO_INCREMENT PRIMARY KEY,
  username VARCHAR(60) NOT NULL UNIQUE,
  password_hash VARCHAR(255) NOT NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE cities (
  id INT AUTO_INCREMENT PRIMARY KEY,
  name_en VARCHAR(80) NOT NULL,
  name_te VARCHAR(80) NOT NULL,
  slug VARCHAR(80) NOT NULL UNIQUE,
  district VARCHAR(80) DEFAULT NULL,
  latitude DECIMAL(10,7) DEFAULT NULL,
  longitude DECIMAL(10,7) DEFAULT NULL
);

CREATE TABLE categories (
  id INT AUTO_INCREMENT PRIMARY KEY,
  name_en VARCHAR(80) NOT NULL,
  name_te VARCHAR(80) NOT NULL,
  slug VARCHAR(80) NOT NULL UNIQUE,
  icon VARCHAR(10) DEFAULT '✨',
  is_venue TINYINT(1) DEFAULT 0
);

CREATE TABLE vendors (
  id INT AUTO_INCREMENT PRIMARY KEY,
  name_en VARCHAR(150) NOT NULL,
  name_te VARCHAR(150) DEFAULT NULL,
  category_id INT NOT NULL,
  city_id INT NOT NULL,
  locality VARCHAR(120) DEFAULT NULL,
  description_en TEXT,
  description_te TEXT,
  price_from INT DEFAULT NULL,
  price_unit ENUM('per_plate','per_day','per_event','onwards') DEFAULT 'onwards',
  capacity INT DEFAULT NULL,
  phone VARCHAR(20) DEFAULT NULL,
  whatsapp VARCHAR(20) DEFAULT NULL,
  email VARCHAR(120) DEFAULT NULL,
  image VARCHAR(255) DEFAULT NULL,
  featured TINYINT(1) DEFAULT 0,
  status ENUM('active','pending','hidden') DEFAULT 'active',
  plan_status ENUM('active','pending','expired','cancelled') DEFAULT 'active',
  plan_months INT DEFAULT NULL,
  plan_started_at DATETIME DEFAULT NULL,
  plan_expires_at DATETIME DEFAULT NULL,
  verification_status ENUM('pending','verified','rejected') DEFAULT 'pending',
  verification_notes TEXT DEFAULT NULL,
  verified_at DATETIME DEFAULT NULL,
  verified_by VARCHAR(60) DEFAULT NULL,
  access_token_hash VARCHAR(64) DEFAULT NULL,
  password_hash VARCHAR(255) DEFAULT NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (category_id) REFERENCES categories(id),
  FOREIGN KEY (city_id) REFERENCES cities(id),
  INDEX idx_filter (status, city_id, category_id)
);

CREATE TABLE reviews (
  id INT AUTO_INCREMENT PRIMARY KEY,
  vendor_id INT NOT NULL,
  name VARCHAR(80) NOT NULL,
  rating TINYINT NOT NULL,
  comment TEXT,
  approved TINYINT(1) DEFAULT 0,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (vendor_id) REFERENCES vendors(id) ON DELETE CASCADE
);

CREATE TABLE enquiries (
  id INT AUTO_INCREMENT PRIMARY KEY,
  vendor_id INT DEFAULT NULL,
  name VARCHAR(80) NOT NULL,
  phone VARCHAR(20) NOT NULL,
  event_date DATE DEFAULT NULL,
  city VARCHAR(80) DEFAULT NULL,
  message TEXT,
  source ENUM('website','call','whatsapp') DEFAULT 'website',
  status ENUM('new','contacted','closed') DEFAULT 'new',
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (vendor_id) REFERENCES vendors(id) ON DELETE SET NULL
);

CREATE TABLE vendor_documents (
  id INT AUTO_INCREMENT PRIMARY KEY,
  vendor_id INT NOT NULL,
  document_type VARCHAR(80) NOT NULL,
  original_name VARCHAR(180) NOT NULL,
  storage_name VARCHAR(80) NOT NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (vendor_id) REFERENCES vendors(id) ON DELETE CASCADE
);

CREATE TABLE payments (
  id INT AUTO_INCREMENT PRIMARY KEY,
  vendor_id INT NOT NULL,
  plan_months INT NOT NULL,
  amount_paise INT NOT NULL,
  razorpay_order_id VARCHAR(100) NOT NULL UNIQUE,
  razorpay_payment_id VARCHAR(100) DEFAULT NULL,
  status ENUM('created','paid','failed') DEFAULT 'created',
  paid_at DATETIME DEFAULT NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (vendor_id) REFERENCES vendors(id) ON DELETE CASCADE
);

INSERT INTO cities (name_en,name_te,slug,district,latitude,longitude) VALUES
('Visakhapatnam','విశాఖపట్నం','visakhapatnam','Visakhapatnam',17.6868000,83.2185000),
('Vijayawada','విజయవాడ','vijayawada','NTR',16.5062000,80.6480000),
('Guntur','గుంటూరు','guntur','Guntur',16.3067000,80.4365000),
('Tirupati','తిరుపతి','tirupati','Tirupati',13.6288000,79.4192000),
('Nellore','నెల్లూరు','nellore','SPSR Nellore',14.4426000,79.9865000),
('Kakinada','కాకినాడ','kakinada','Kakinada',16.9891000,82.2475000),
('Rajamahendravaram','రాజమహేంద్రవరం','rajamahendravaram','East Godavari',17.0005000,81.8040000),
('Kurnool','కర్నూలు','kurnool','Kurnool',15.8281000,78.0373000),
('Anantapur','అనంతపురం','anantapur','Anantapur',14.6819000,77.6006000),
('Kadapa','కడప','kadapa','YSR Kadapa',14.4673000,78.8242000),
('Eluru','ఏలూరు','eluru','Eluru',16.7107000,81.0952000),
('Tadepalligudem','తాడేపల్లిగూడెం','tadepalligudem','West Godavari',16.8147000,81.5260000),
('Bhimavaram','భీమవరం','bhimavaram','West Godavari',16.5449000,81.5212000),
('Ongole','ఒంగోలు','ongole','Prakasam',15.5057000,80.0499000),
('Amaravati','అమరావతి','amaravati','Guntur',16.5745000,80.3598000),
('Srikakulam','శ్రీకాకుళం','srikakulam','Srikakulam',18.2949000,83.8938000),
('Vizianagaram','విజయనగరం','vizianagaram','Vizianagaram',18.1067000,83.3956000),
('Machilipatnam','మచిలీపట్నం','machilipatnam','Krishna',16.1809000,81.1300000),
('Nandyal','నంద్యాల','nandyal','Nandyal',15.4779000,78.4836000),
('Proddatur','ప్రొద్దుటూరు','proddatur','YSR Kadapa',14.7502000,78.5481000),
('Hindupur','హిందూపురం','hindupur','Sri Sathya Sai',13.8281000,77.4914000),
('Chittoor','చిత్తూరు','chitoor','Chittoor',13.2172000,79.1003000),
('Madanapalle','మదనపల్లె','madanapalle','Annamayya',13.5503000,78.5029000),
('Tenali','తెనాలి','tenali','Guntur',16.2428000,80.6405000),
('Narasaraopet','నరసరావుపేట','narasaraopet','Palnadu',16.2353000,80.0479000),
('Chilakaluripet','చిలకలూరిపేట','chilakaluripet','Palnadu',16.0892000,80.1672000),
('Gudivada','గుడివాడ','gudivada','Krishna',16.4355000,80.9956000),
('Nuzvid','నూజివీడు','nuzvid','Eluru',16.7880000,80.8450000),
('Tanuku','తణుకు','tanuku','West Godavari',16.7547000,81.6814000),
('Palakollu','పాలకొల్లు','palakollu','West Godavari',16.5167000,81.7300000),
('Amalapuram','అమలాపురం','amalapuram','Konaseema',16.5787000,82.0061000),
('Mandapeta','మండపేట','mandapeta','Konaseema',16.8625000,81.9292000),
('Tuni','తుని','tuni','Kakinada',17.3560000,82.5467000),
('Pithapuram','పిఠాపురం','pithapuram','Kakinada',17.1168000,82.2528000),
('Parvathipuram','పార్వతీపురం','parvathipuram','Parvathipuram Manyam',18.7835000,83.4255000),
('Rayachoty','రాయచోటి','rayachoty','Annamayya',14.0572000,78.7500000),
('Kavali','కావలి','kavali','SPSR Nellore',14.9163000,79.9947000),
('Hyderabad','హైదరాబాద్','hyderabad','Hyderabad',17.3850000,78.4867000),
('Warangal','వరంగల్','warangal','Warangal',17.9689000,79.5941000),
('Hanamkonda','హనుమకొండ','hanamkonda','Hanamkonda',17.9927000,79.5300000),
('Karimnagar','కరీంనగర్','karimnagar','Karimnagar',18.4386000,79.1288000),
('Nizamabad','నిజామాబాద్','nizamabad','Nizamabad',18.6725000,78.0941000),
('Khammam','ఖమ్మం','khammam','Khammam',17.2473000,80.1514000),
('Mahbubnagar','మహబూబ్‌నగర్','mahbubnagar','Mahbubnagar',16.7488000,78.0035000),
('Nalgonda','నల్గొండ','nalgonda','Nalgonda',17.0575000,79.2684000),
('Adilabad','ఆదిలాబాద్','adilabad','Adilabad',19.6641000,78.5320000),
('Suryapet','సూర్యాపేట','suryapet','Suryapet',17.1405000,79.6236000),
('Miryalaguda','మిర్యాలగూడ','miryalaguda','Nalgonda',16.8730000,79.5625000),
('Siddipet','సిద్దిపేట','siddipet','Siddipet',18.1018000,78.8520000),
('Jagtial','జగిత్యాల','jagtial','Jagtial',18.7945000,78.9166000),
('Mancherial','మంచిర్యాల','mancherial','Mancherial',18.8756000,79.4591000),
('Ramagundam','రామగుండం','ramagundam','Peddapalli',18.7550000,79.4740000),
('Kothagudem','కొత్తగూడెం','kothagudem','Bhadradri Kothagudem',17.5510000,80.6178000),
('Bhadrachalam','భద్రాచలం','bhadrachalam','Bhadradri Kothagudem',17.6688000,80.8936000),
('Sangareddy','సంగారెడ్డి','sangareddy','Sangareddy',17.6190000,78.0816000),
('Medak','మెదక్','medak','Medak',18.0453000,78.2608000),
('Vikarabad','వికారాబాద్','vikarabad','Vikarabad',17.3381000,77.9044000),
('Tandur','తాండూరు','tandur','Vikarabad',17.2485000,77.5769000),
('Wanaparthy','వనపర్తి','wanaparthy','Wanaparthy',16.3610000,78.0622000),
('Gadwal','గద్వాల','gadwal','Jogulamba Gadwal',16.2340000,77.7950000),
('Narayanpet','నారాయణపేట','narayanpet','Narayanpet',16.7470000,77.4950000),
('Kamareddy','కామారెడ్డి','kamareddy','Kamareddy',18.3200000,78.3410000),
('Bodhan','బోధన్','bodhan','Nizamabad',18.6700000,77.9000000),
('Armoor','ఆర్మూర్','armoor','Nizamabad',18.7900000,78.2900000),
('Bhupalpally','భూపాలపల్లి','bhupalpally','Jayashankar Bhupalpally',18.4380000,79.8630000),
('Mahabubabad','మహబూబాబాద్','mahabubabad','Mahabubabad',17.5970000,80.0050000),
('Jangaon','జనగాం','jangaon','Jangaon',17.7260000,79.1520000),
('Yadagirigutta','యాదగిరిగుట్ట','yadagirigutta','Yadadri Bhuvanagiri',17.5890000,78.9440000),
('Bhongir','భువనగిరి','bhongir','Yadadri Bhuvanagiri',17.5150000,78.8850000),
('Kodad','కోదాడ','kodad','Suryapet',16.9970000,79.9650000),
('Huzurnagar','హుజూర్‌నగర్','huzurnagar','Suryapet',17.0550000,79.8870000),
('Devarakonda','దేవరకొండ','devarakonda','Nalgonda',16.6950000,78.9220000),
('Alampur','ఆలంపూర్','alampur','Jogulamba Gadwal',15.8790000,78.1330000),
('Paderu','పాడేరు','paderu','Alluri Sitarama Raju',18.0800000,82.6700000),
('Anakapalli','అనకాపల్లి','anakapalli','Anakapalli',17.6913000,83.0039000),
('Bapatla','బాపట్ల','bapatla','Bapatla',15.9044000,80.4675000),
('Puttaparthi','పుట్టపర్తి','puttaparthi','Sri Sathya Sai',14.1650000,77.8110000),
('Nirmal','నిర్మల్','nirmal','Nirmal',19.0960000,78.3440000),
('Sircilla','సిరిసిల్ల','sircilla','Rajanna Sircilla',18.3886000,78.8100000),
('Nagarkurnool','నాగర్‌కర్నూల్','nagarkurnool','Nagarkurnool',16.4820000,78.3240000),
('Asifabad','ఆసిఫాబాద్','asifabad','Komaram Bheem Asifabad',19.3585000,79.2870000),
('Mulugu','ములుగు','mulugu','Mulugu',18.1910000,79.9430000),
('Peddapalli','పెద్దపల్లి','peddapalli','Peddapalli',18.6130000,79.3790000),
('Shamshabad','శంషాబాద్','shamshabad','Rangareddy',17.2514000,78.4370000);

INSERT INTO categories (name_en,name_te,slug,icon,is_venue) VALUES
('Kalyana Mandapams','కళ్యాణ మండపాలు','kalyana-mandapams','🏛️',1),
('Banquet Halls & Hotels','బాంకెట్ హాళ్లు & హోటళ్లు','banquet-halls','🏨',1),
('Photographers','ఫోటోగ్రాఫర్లు','photographers','📷',0),
('Bridal Makeup','బ్రైడల్ మేకప్','bridal-makeup','💄',0),
('Mehendi Artists','మెహందీ ఆర్టిస్టులు','mehendi-artists','🌿',0),
('Decorators','డెకరేటర్లు','decorators','🌸',0),
('Wedding Planners','వెడ్డింగ్ ప్లానర్లు','wedding-planners','📋',0),
('Catering','క్యాటరింగ్','catering','🍛',0),
('Pattu Sarees & Bridal Wear','పట్టు చీరలు & బ్రైడల్ వేర్','bridal-wear','👗',0),
('Jewellery','నగలు','jewellery','💍',0),
('Invitations','శుభలేఖలు','invitations','✉️',0),
('Pandits & Purohits','పురోహితులు','pandits','🪔',0),
('Music & Nadaswaram','సంగీతం & నాదస్వరం','music','🎶',0);

-- SAMPLE vendors (fictional demo data - replace with real vendors from the admin panel)
INSERT INTO vendors (name_en,name_te,category_id,city_id,locality,description_en,description_te,price_from,price_unit,capacity,phone,whatsapp,featured) VALUES
('Sri Venkateswara Kalyana Mandapam','శ్రీ వేంకటేశ్వర కళ్యాణ మండపం',1,4,'Korlagunta','Traditional air-conditioned mandapam with a pillared stage, in-house parking and a dining hall for 600 guests.','స్తంభాల వేదిక, పార్కింగ్ మరియు 600 మంది అతిథులకు భోజనశాలతో కూడిన సంప్రదాయ ఏసీ కళ్యాణ మండపం.',85000,'per_day',800,'9000000001','9000000001',1),
('Godavari Grand Banquets','గోదావరి గ్రాండ్ బాంకెట్స్',2,7,'Danavaipeta','Elegant banquet with a lawn, bridal suite and multi-cuisine catering on the banks of the Godavari.','గోదావరి తీరంలో లాన్, బ్రైడల్ సూట్ మరియు మల్టీ-క్యూజిన్ క్యాటరింగ్‌తో అందమైన బాంకెట్.',650,'per_plate',1000,'9000000002','9000000002',1),
('Bay View Convention & Resort','బే వ్యూ కన్వెన్షన్ & రిసార్ట్',2,1,'Rushikonda','Beachside resort venue for destination-style weddings with sea-facing mandap and rooms for guests.','సముద్ర తీర రిసార్ట్ వేదిక; సముద్రం వైపు మండపం మరియు అతిథుల కోసం గదులు.',1400,'per_plate',1500,'9000000003','9000000003',1),
('Krishna Leela Function Hall','కృష్ణ లీల ఫంక్షన్ హాల్',1,2,'Benz Circle','Centrally located hall with ample parking and flexible decor and catering options.','విశాలమైన పార్కింగ్ మరియు సౌకర్యవంతమైన డెకర్, క్యాటరింగ్ ఎంపికలతో నగర మధ్యలో ఉన్న హాల్.',70000,'per_day',700,'9000000004','9000000004',0),
('Lens & Lights by Praveen','లెన్స్ & లైట్స్ - ప్రవీణ్',3,2,'Labbipet','Candid, traditional and cinematic wedding films. Drone coverage and same-week teaser delivery.','క్యాండిడ్, సంప్రదాయ మరియు సినిమాటిక్ పెళ్లి చిత్రీకరణ. డ్రోన్ కవరేజ్ మరియు టీజర్ వారంలోనే.',45000,'onwards',NULL,'9000000005','9000000005',1),
('Frames of Forever','ఫ్రేమ్స్ ఆఫ్ ఫరెవర్',3,1,'Dwaraka Nagar','Pre-wedding shoots at Araku, Yarada and Kailasagiri, plus wedding day coverage.','అరకు, యారాడ, కైలాసగిరి వద్ద ప్రీ-వెడ్డింగ్ షూట్లు మరియు పెళ్లి రోజు కవరేజ్.',55000,'onwards',NULL,'9000000006','9000000006',0),
('Meghana Bridal Studio','మేఘన బ్రైడల్ స్టూడియో',4,3,'Brodipet','HD and airbrush bridal makeup, hair styling and saree draping by certified artists.','సర్టిఫైడ్ ఆర్టిస్టులచే HD, ఎయిర్‌బ్రష్ బ్రైడల్ మేకప్, హెయిర్ స్టైలింగ్ మరియు చీర కట్టు.',18000,'per_event',NULL,'9000000007','9000000007',1),
('Glow by Sindhu','గ్లో బై సింధు',4,12,'Main Road','Natural-look bridal makeup and family makeup packages in Tadepalligudem and nearby towns.','తాడేపల్లిగూడెం మరియు చుట్టుపక్కల ప్రాంతాల్లో సహజమైన బ్రైడల్ మరియు ఫ్యామిలీ మేకప్ ప్యాకేజీలు.',12000,'per_event',NULL,'9000000008','9000000008',0),
('Gorintaku Mehendi Arts','గోరింటాకు మెహందీ ఆర్ట్స్',5,13,'Town','Bridal, Arabic and traditional gorintaku designs. Group bookings for sangeet welcome.','బ్రైడల్, అరబిక్ మరియు సంప్రదాయ గోరింటాకు డిజైన్లు. సంగీత్ కోసం గ్రూప్ బుకింగ్.',3500,'onwards',NULL,'9000000009','9000000009',0),
('Pushpa Mandapa Decorators','పుష్ప మండప డెకరేటర్స్',6,2,'Governorpet','Floral mandap, stage, entrance and car decor with fresh flowers from local growers.','తాజా పూలతో మండపం, స్టేజ్, ప్రవేశ ద్వారం మరియు కారు అలంకరణ.',60000,'onwards',NULL,'9000000010','9000000010',1),
('Muhurtham Wedding Planners','ముహూర్తం వెడ్డింగ్ ప్లానర్స్',7,1,'MVP Colony','Full-service planning from muhurtham selection to vidaai - vendors, budgets and guest hospitality.','ముహూర్తం నుండి అప్పగింతల వరకు పూర్తి ప్లానింగ్ - వెండర్లు, బడ్జెట్, అతిథి సత్కారం.',150000,'onwards',NULL,'9000000011','9000000011',1),
('Ruchi Catering Services','రుచి క్యాటరింగ్ సర్వీసెస్',8,3,'Arundelpet','Authentic Andhra veg and non-veg wedding feasts, from banana-leaf meals to live counters.','అరిటాకు భోజనం నుండి లైవ్ కౌంటర్ల వరకు ఆంధ్ర శాకాహార, మాంసాహార పెళ్లి విందులు.',450,'per_plate',NULL,'9000000012','9000000012',0),
('Kanchi Pattu Mahal','కంచి పట్టు మహల్',9,2,'MG Road','Kanchipuram, Dharmavaram and Venkatagiri pattu sarees plus groom sherwanis and panche sets.','కంచి, ధర్మవరం, వెంకటగిరి పట్టు చీరలు; వరుల కోసం షేర్వానీలు, పంచెల సెట్లు.',9000,'onwards',NULL,'9000000013','9000000013',0),
('Swarna Jewellers','స్వర్ణ జ్యువెలర్స్',10,5,'Stonehousepeta','Temple jewellery, kasula haram and bridal diamond sets with transparent making charges.','టెంపుల్ జ్యువెలరీ, కాసుల హారం మరియు బ్రైడల్ డైమండ్ సెట్లు.',25000,'onwards',NULL,'9000000014','9000000014',0),
('Pandit Ramakrishna Sharma','పండిట్ రామకృష్ణ శర్మ',12,4,'Tirumala Bypass','Experienced purohit for Telugu vivaham, nischitartham and gruhapravesham with muhurtham guidance.','తెలుగు వివాహం, నిశ్చితార్థం, గృహప్రవేశం కోసం అనుభవజ్ఞులైన పురోహితులు.',11000,'per_event',NULL,'9000000015','9000000015',0),
('Mangala Vadyam Nadaswaram Troupe','మంగళ వాద్యం నాదస్వరం బృందం',13,2,'Patamata','Live nadaswaram and thavil for muhurtham, baraat and reception, 6 to 10 artists.','ముహూర్తం, బరాత్, రిసెప్షన్ కోసం లైవ్ నాదస్వరం మరియు డోలు, 6 నుండి 10 కళాకారులు.',20000,'per_event',NULL,'9000000016','9000000016',0);

INSERT INTO reviews (vendor_id,name,rating,comment,approved) VALUES
(1,'Lakshmi P.',5,'Well maintained and the staff were very cooperative.',1),
(5,'Harsha & Divya',5,'Our wedding film was beautiful. Delivered on time.',1),
(7,'Sravani',4,'Makeup lasted the whole day. Very professional.',1),
(11,'Karthik R.',5,'They handled everything so we could enjoy our wedding.',1);
-- Admin user is created automatically by app.py on first run.
