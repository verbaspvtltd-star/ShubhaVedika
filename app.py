"""ShubhaVedika bilingual Telugu wedding marketplace."""
import os, uuid, functools, hashlib, hmac, json, secrets
from datetime import datetime, timedelta
import pymysql, pymysql.cursors
from flask import Flask, g, jsonify, request, render_template, session, redirect, send_file, abort
from werkzeug.security import generate_password_hash, check_password_hash
from werkzeug.utils import secure_filename
from config import Config

app = Flask(__name__)
app.config.from_object(Config)
app.config['MAX_CONTENT_LENGTH'] = 12 * 1024 * 1024
PUBLIC_UPLOAD_DIR = os.path.join(app.static_folder, 'uploads')
PRIVATE_UPLOAD_DIR = os.path.join(app.instance_path, 'private_vendor_proofs')
os.makedirs(PUBLIC_UPLOAD_DIR, exist_ok=True)
os.makedirs(PRIVATE_UPLOAD_DIR, exist_ok=True)
IMG_EXT = {'jpg','jpeg','png','webp'}
PROOF_EXT = {'pdf','jpg','jpeg','png','webp'}
# Subscription prices are stored in paise. GST is calculated server-side at 18%.
PLAN_BASE_AMOUNTS = {1: 33300, 3: 66600, 6: 99900, 12: 189900}
PLANS = {
    months: {
        'name': name, 'days': days,
        'base_amount': base_amount,
        'gst_amount': round(base_amount * 18 / 100),
        'amount': base_amount + round(base_amount * 18 / 100)
    }
    for months, name, days, base_amount in [
        (1, '1 Month', 30, PLAN_BASE_AMOUNTS[1]),
        (3, '3 Months', 90, PLAN_BASE_AMOUNTS[3]),
        (6, '6 Months', 180, PLAN_BASE_AMOUNTS[6]),
        (12, '12 Months', 365, PLAN_BASE_AMOUNTS[12])
    ]
}



def db():
    if 'db' not in g:
        g.db = pymysql.connect(
            host=Config.DB_HOST,
            port=Config.DB_PORT,
            user=Config.DB_USER,
            password=Config.DB_PASSWORD,
            database=Config.DB_NAME,
            charset='utf8mb4',
            cursorclass=pymysql.cursors.DictCursor,
            autocommit=True,

            # Secure connection to TiDB Cloud
            ssl_ca='/etc/ssl/certs/ca-certificates.crt',
            ssl_verify_cert=True,
            ssl_verify_identity=True
        )
    return g.db


@app.teardown_appcontext
def close_db(_):
    conn = g.pop('db', None)
    if conn: conn.close()

def query(sql, args=(), one=False):
    with db().cursor() as c:
        c.execute(sql, args)
        return c.fetchone() if one else c.fetchall()

def execute(sql, args=()):
    with db().cursor() as c:
        c.execute(sql, args)
        return c.lastrowid

def admin_required(fn):
    @functools.wraps(fn)
    def wrap(*a, **k):
        if not session.get('admin'): return jsonify(error='Unauthorized'), 401
        return fn(*a, **k)
    return wrap

def clean(s, n=500): return (s or '').strip()[:n]
def slugify(s): return '-'.join(''.join(ch if ch.isalnum() else ' ' for ch in (s or '').lower()).split())
def save_public_image(file):
    if not file or not file.filename: return None
    ext = file.filename.rsplit('.',1)[-1].lower()
    if ext not in IMG_EXT: return None
    name = uuid.uuid4().hex + '.' + ext
    file.save(os.path.join(PUBLIC_UPLOAD_DIR, secure_filename(name)))
    return '/static/uploads/' + name

def save_private_proof(file, vendor_id, doc_type):
    if not file or not file.filename: return
    ext = file.filename.rsplit('.',1)[-1].lower()
    if ext not in PROOF_EXT: raise ValueError('Proof must be PDF, JPG, PNG or WEBP')
    head=file.stream.read(16); file.stream.seek(0)
    valid=((ext=='pdf' and head.startswith(b'%PDF')) or
           (ext in ('jpg','jpeg') and head.startswith(b'\xff\xd8\xff')) or
           (ext=='png' and head.startswith(b'\x89PNG\r\n\x1a\n')) or
           (ext=='webp' and head.startswith(b'RIFF') and head[8:12]==b'WEBP'))
    if not valid: raise ValueError('The uploaded proof file content does not match its file type')
    name = uuid.uuid4().hex + '.' + ext
    path = os.path.join(PRIVATE_UPLOAD_DIR, name)
    file.save(path)
    execute('INSERT INTO vendor_documents (vendor_id,document_type,original_name,storage_name) VALUES (%s,%s,%s,%s)',
            (vendor_id, clean(doc_type,60) or 'Business proof', secure_filename(file.filename)[:180], name))

VENDOR_SELECT = """SELECT v.id,v.name_en,v.name_te,v.category_id,v.city_id,v.locality,v.description_en,v.description_te,
 v.price_from,v.price_unit,v.capacity,v.phone,v.whatsapp,v.email,v.image,v.featured,v.status,
 c.name_en city_en,c.name_te city_te,c.slug city_slug,c.latitude,c.longitude,
 cat.name_en cat_en,cat.name_te cat_te,cat.slug cat_slug,cat.icon,
 (SELECT ROUND(AVG(r.rating),1) FROM reviews r WHERE r.vendor_id=v.id AND r.approved=1) avg_rating,
 (SELECT COUNT(*) FROM reviews r WHERE r.vendor_id=v.id AND r.approved=1) review_count
 FROM vendors v JOIN cities c ON c.id=v.city_id JOIN categories cat ON cat.id=v.category_id"""
ADMIN_VENDOR_SELECT = VENDOR_SELECT.replace('v.price_from,v.price_unit,v.capacity,v.phone', 'v.price_from,v.price_unit,v.capacity,v.plan_status,v.plan_months,v.plan_started_at,v.plan_expires_at,v.verification_status,v.verification_notes,v.verified_at,v.verified_by,v.phone')
DASH_VENDOR_SELECT = VENDOR_SELECT.replace('v.price_from,v.price_unit,v.capacity,v.phone', 'v.price_from,v.price_unit,v.capacity,v.plan_status,v.plan_months,v.plan_started_at,v.plan_expires_at,v.verification_status,v.phone')

def expire_due_plans():
    execute("UPDATE vendors SET plan_status='expired',status='hidden' WHERE plan_expires_at IS NOT NULL AND plan_expires_at<=UTC_TIMESTAMP() AND plan_status='active'")

@app.route('/')
def home(): return render_template('index.html', page='home')
@app.route('/vendors')
def vendors_page(): return render_template('vendors.html', page='vendors')
@app.route('/vendor/<int:vid>')
def vendor_page(vid): return render_template('vendor.html', page='vendor', vid=vid)
@app.route('/register-vendor')
def register_page(): return render_template('register.html', page='register')
@app.route('/vendor-dashboard')
def vendor_dashboard_page(): return render_template('vendor-dashboard.html', page='vendor-dashboard')
@app.route('/vendor-verification')
def vendor_verification_page(): return render_template('vendor-verification.html', page='vendor-verification')
@app.route('/vendor-account-setup')
def vendor_account_setup_page(): return render_template('vendor-account-setup.html', page='vendor-account-setup')
@app.route('/vendor-login')
def vendor_login_page(): return render_template('vendor-login.html', page='vendor-login')
@app.route('/admin')
def admin_page():
    if not session.get('admin'): return redirect('/admin/login')
    return render_template('admin/index.html')
@app.route('/admin/login')
def admin_login_page(): return render_template('admin/login.html')

@app.get('/api/meta')
def meta(): return jsonify(cities=query('SELECT * FROM cities ORDER BY name_en'), categories=query('SELECT * FROM categories ORDER BY id'))

@app.get('/api/home')
def home_data():
    expire_due_plans()
    featured = query(VENDOR_SELECT + " WHERE v.status='active' AND v.plan_status='active' ORDER BY v.featured DESC,v.id DESC LIMIT 8")
    stats = query("SELECT (SELECT COUNT(*) FROM vendors WHERE status='active' AND plan_status='active') vendors,(SELECT COUNT(*) FROM cities) cities,(SELECT COUNT(*) FROM categories) categories", one=True)
    counts = query("SELECT city_id,COUNT(*) n FROM vendors WHERE status='active' AND plan_status='active' GROUP BY city_id")
    return jsonify(featured=featured, stats=stats, city_counts={r['city_id']:r['n'] for r in counts})

@app.get('/api/vendors')
def list_vendors():
    expire_due_plans()
    a=request.args; where=["v.status='active'", "v.plan_status='active'"]; args=[]
    if a.get('city'): where.append('c.slug=%s'); args.append(a['city'])
    if a.get('category'): where.append('cat.slug=%s'); args.append(a['category'])
    if a.get('q'):
        like='%'+a['q']+'%'; where.append('(v.name_en LIKE %s OR v.name_te LIKE %s OR v.locality LIKE %s OR c.name_en LIKE %s OR c.name_te LIKE %s)'); args += [like]*5
    if a.get('min','').isdigit(): where.append('v.price_from>=%s'); args.append(int(a['min']))
    if a.get('max','').isdigit(): where.append('v.price_from<=%s'); args.append(int(a['max']))
    order={'price_asc':'v.price_from ASC','price_desc':'v.price_from DESC','new':'v.id DESC'}.get(a.get('sort'),'avg_rating IS NULL,avg_rating DESC,v.featured DESC')
    page=max(int(a.get('page',1) or 1),1); per=9; base=VENDOR_SELECT+' WHERE '+' AND '.join(where)
    total=query(f'SELECT COUNT(*) n FROM ({base}) t',args,one=True)['n']
    items=query(f'{base} ORDER BY {order} LIMIT %s OFFSET %s',args+[per,(page-1)*per])
    return jsonify(items=items,total=total,page=page,per=per)

@app.get('/api/vendors/<int:vid>')
def get_vendor(vid):
    expire_due_plans()
    v=query(VENDOR_SELECT+" WHERE v.id=%s AND v.status='active' AND v.plan_status='active'",(vid,),one=True)
    if not v: return jsonify(error='Not found'),404
    reviews=query('SELECT name,rating,comment,created_at FROM reviews WHERE vendor_id=%s AND approved=1 ORDER BY id DESC',(vid,))
    similar=query(VENDOR_SELECT+" WHERE v.status='active' AND v.plan_status='active' AND v.category_id=%s AND v.id<>%s ORDER BY RAND() LIMIT 3",(v['category_id'],vid))
    return jsonify(vendor=v,reviews=reviews,similar=similar)

@app.post('/api/enquiries')
def add_enquiry():
    d=request.get_json(silent=True) or {}; name=clean(d.get('name'),80); phone=clean(d.get('phone'),20)
    if len(name)<2 or not phone.replace('+','').replace(' ','').isdigit() or len(phone)<10: return jsonify(error='Please enter a valid name and phone number'),400
    execute("INSERT INTO enquiries (vendor_id,name,phone,event_date,city,message,source) VALUES (%s,%s,%s,%s,%s,%s,'website')",
      (d.get('vendor_id') or None,name,phone,d.get('event_date') or None,clean(d.get('city'),80),clean(d.get('message'))))
    return jsonify(ok=True),201

@app.post('/api/contact-click')
def contact_click():
    d=request.get_json(silent=True) or {}; source=d.get('source')
    if source not in ('call','whatsapp'): return jsonify(error='Invalid contact source'),400
    vid=int(d.get('vendor_id') or 0); v=query('SELECT id,name_en,phone,whatsapp FROM vendors WHERE id=%s AND status=\'active\' AND plan_status=\'active\'',(vid,),one=True)
    if not v: return jsonify(error='Vendor unavailable'),404
    # This records a contact-intent click, not proof that a call/message was completed.
    execute("INSERT INTO enquiries (vendor_id,name,phone,city,message,source) VALUES (%s,%s,%s,%s,%s,%s)",
      (vid,'Website visitor', '', '', 'Customer clicked '+source+' contact button',source))
    return jsonify(ok=True,phone=(v['phone'] if source=='call' else (v['whatsapp'] or v['phone'])) )

@app.post('/api/vendors/<int:vid>/reviews')
def add_review(vid):
    d=request.get_json(silent=True) or {}
    try: rating=int(d.get('rating'))
    except (TypeError,ValueError): rating=0
    name=clean(d.get('name'),80)
    if not (1<=rating<=5) or len(name)<2: return jsonify(error='Name and rating (1-5) required'),400
    execute('INSERT INTO reviews (vendor_id,name,rating,comment) VALUES (%s,%s,%s,%s)',(vid,name,rating,clean(d.get('comment'))))
    return jsonify(ok=True,message='Thanks! Your review will appear after approval.'),201

@app.post('/api/vendor-register')
def vendor_register():
    f=request.form
    if not clean(f.get('name_en')) or not clean(f.get('phone')): return jsonify(error='Business name and phone are required'),400
    try: months=int(f.get('plan_months','0'))
    except ValueError: months=0
    if months not in PLANS: return jsonify(error='Select a valid subscription plan'),400
    token=secrets.token_urlsafe(32); token_hash=hashlib.sha256(token.encode()).hexdigest()
    vals=vendor_values(f,save_public_image(request.files.get('image')))
    vid=execute("""INSERT INTO vendors (name_en,name_te,category_id,city_id,locality,description_en,description_te,price_from,price_unit,phone,whatsapp,email,image,status,plan_status,verification_status,access_token_hash)
      VALUES (%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,'pending','pending','pending',%s)""", vals[:13]+(token_hash,))
    return jsonify(ok=True,vendor_id=vid,vendor_token=token,plan_months=months,amount=PLANS[months]['amount'],base_amount=PLANS[months]['base_amount'],gst_amount=PLANS[months]['gst_amount'],plan_name=PLANS[months]['name']),201

def vendor_values(f,image):
    price=f.get('price_from'); unit=f.get('price_unit') if f.get('price_unit') in ('per_plate','per_day','per_event','onwards') else 'onwards'
    return (clean(f.get('name_en'),150),clean(f.get('name_te'),150) or None,int(f.get('category_id') or 1),int(f.get('city_id') or 1),clean(f.get('locality'),120),clean(f.get('description_en'),2000),clean(f.get('description_te'),2000),int(price) if price and price.isdigit() else None,unit,clean(f.get('phone'),20),clean(f.get('whatsapp'),20),clean(f.get('email'),120),image)

# Razorpay credentials are read directly from the running process environment.
# Add RAZORPAY_KEY_ID and RAZORPAY_KEY_SECRET to the Render web service environment.
def get_razorpay_credentials():
    key_id = (os.getenv('RAZORPAY_KEY_ID') or '').strip()
    key_secret = (os.getenv('RAZORPAY_KEY_SECRET') or '').strip()
    return key_id, key_secret

def razorpay_client():
    try:
        import razorpay
    except ImportError:
        app.logger.exception('Razorpay SDK is not installed.')
        return None

    key_id, key_secret = get_razorpay_credentials()
    if not key_id or not key_secret:
        app.logger.error('Razorpay credentials are missing from the service environment.')
        return None

    try:
        return razorpay.Client(auth=(key_id, key_secret))
    except Exception:
        app.logger.exception('Unable to initialize Razorpay client.')
        return None

@app.post('/api/payment/order')
def payment_order():
    d=request.get_json(silent=True) or {}; vid=int(d.get('vendor_id') or 0); months=int(d.get('plan_months') or 0)
    token=clean(d.get('vendor_token'),120); v=query('SELECT id,access_token_hash FROM vendors WHERE id=%s',(vid,),one=True)
    if not v or not token or not hmac.compare_digest(v['access_token_hash'] or '',hashlib.sha256(token.encode()).hexdigest()): return jsonify(error='Vendor session invalid'),403
    if months not in PLANS: return jsonify(error='Invalid plan'),400
    client=razorpay_client()
    if not client: return jsonify(error='Razorpay is not configured. Add RAZORPAY_KEY_ID and RAZORPAY_KEY_SECRET to the server environment.'),503
    plan=PLANS[months]
    order=client.order.create({'amount':plan['amount'],'currency':'INR','receipt':f'sv-{vid}-{uuid.uuid4().hex[:10]}','notes':{'vendor_id':str(vid),'plan_months':str(months),'base_amount_paise':str(plan['base_amount']),'gst_amount_paise':str(plan['gst_amount']),'gst_rate':'18%'}})
    execute('INSERT INTO payments (vendor_id,plan_months,amount_paise,razorpay_order_id,status) VALUES (%s,%s,%s,%s,\'created\')',(vid,months,plan['amount'],order['id']))
    key_id, _ = get_razorpay_credentials()
    return jsonify(order_id=order['id'],amount=plan['amount'],currency='INR',key_id=key_id,plan_name=plan['name'],base_amount=plan['base_amount'],gst_amount=plan['gst_amount'])

@app.post('/api/payment/verify')
def payment_verify():
    d=request.get_json(silent=True) or {}; vid=int(d.get('vendor_id') or 0); token=clean(d.get('vendor_token'),120)
    v=query('SELECT id,access_token_hash FROM vendors WHERE id=%s',(vid,),one=True)
    if not v or not hmac.compare_digest(v['access_token_hash'] or '',hashlib.sha256(token.encode()).hexdigest()): return jsonify(error='Vendor session invalid'),403
    client=razorpay_client()
    if not client: return jsonify(error='Payment gateway is not configured'),503
    order_id=clean(d.get('razorpay_order_id'),100); payment_id=clean(d.get('razorpay_payment_id'),100); signature=clean(d.get('razorpay_signature'),200)
    try: client.utility.verify_payment_signature({'razorpay_order_id':order_id,'razorpay_payment_id':payment_id,'razorpay_signature':signature})
    except Exception: return jsonify(error='Payment signature verification failed'),400
    p=query("SELECT * FROM payments WHERE razorpay_order_id=%s AND vendor_id=%s",(order_id,vid),one=True)
    if not p: return jsonify(error='Payment order not found'),400
    if p['status']=='paid' and p.get('razorpay_payment_id')==payment_id:
        current=query('SELECT plan_expires_at FROM vendors WHERE id=%s',(vid,),one=True)
        return jsonify(ok=True,expires_at=current['plan_expires_at'].isoformat() if current and current['plan_expires_at'] else None)
    if p['status']!='created': return jsonify(error='Payment order is not awaiting payment'),400
    try:
        payment=client.payment.fetch(payment_id)
        if payment.get('order_id')!=order_id or int(payment.get('amount',0))!=int(p['amount_paise']) or payment.get('status')!='captured':
            return jsonify(error='Payment is not captured or does not match this order'),400
    except Exception:
        return jsonify(error='Unable to confirm captured payment with Razorpay'),400
    start=datetime.utcnow(); end=start+timedelta(days=PLANS[p['plan_months']]['days'])
    execute("UPDATE payments SET razorpay_payment_id=%s,status='paid',paid_at=UTC_TIMESTAMP() WHERE id=%s",(payment_id,p['id']))
    execute("UPDATE vendors SET status='pending',plan_status='active',plan_months=%s,plan_started_at=%s,plan_expires_at=%s WHERE id=%s",(p['plan_months'],start,end,vid))
    return jsonify(ok=True,expires_at=end.isoformat()+'Z')

@app.post('/api/payment/webhook')
def payment_webhook():
    secret=(os.getenv('RAZORPAY_WEBHOOK_SECRET') or '').strip()
    if not secret: return jsonify(error='Webhook secret is not configured'),503
    signature=request.headers.get('X-Razorpay-Signature','')
    expected=hmac.new(secret.encode(),request.get_data(),hashlib.sha256).hexdigest()
    if not hmac.compare_digest(signature,expected): return jsonify(error='Invalid webhook signature'),400
    event=request.get_json(silent=True) or {}
    if event.get('event')=='payment.captured':
        entity=((event.get('payload') or {}).get('payment') or {}).get('entity') or {}
        order_id=entity.get('order_id'); payment_id=entity.get('id')
        p=query("SELECT * FROM payments WHERE razorpay_order_id=%s AND status='created'",(order_id,),one=True)
        if p:
            start=datetime.utcnow(); end=start+timedelta(days=PLANS[p['plan_months']]['days'])
            execute("UPDATE payments SET razorpay_payment_id=%s,status='paid',paid_at=UTC_TIMESTAMP() WHERE id=%s",(payment_id,p['id']))
            execute("UPDATE vendors SET status='pending',plan_status='active',plan_months=%s,plan_started_at=%s,plan_expires_at=%s WHERE id=%s",(p['plan_months'],start,end,p['vendor_id']))
    return jsonify(ok=True)

@app.get('/api/vendor/dashboard')
def vendor_dashboard():
    expire_due_plans()
    token=request.headers.get('X-Vendor-Token',''); vh=hashlib.sha256(token.encode()).hexdigest()
    v=query(DASH_VENDOR_SELECT+" WHERE v.access_token_hash=%s",(vh,),one=True)
    if not v: return jsonify(error='Vendor access expired. Contact support.'),401
    # Return only enquiries belonging to the currently authenticated vendor.
    # The access token is resolved above, so vendors cannot read another vendor's enquiries.
    enquiry_items=query(
        "SELECT id,name,phone,event_date,city,message,source,created_at "
        "FROM enquiries WHERE vendor_id=%s ORDER BY id DESC LIMIT 100",
        (v['id'],)
    )
    return jsonify(vendor=v,enquiries=len(enquiry_items),enquiry_items=enquiry_items,plans=PLANS)


# Vendor account setup, login and private Aadhaar document upload.
def vendor_from_token(token):
    token=clean(token,160)
    if not token: return None
    digest=hashlib.sha256(token.encode()).hexdigest()
    return query("SELECT * FROM vendors WHERE access_token_hash=%s",(digest,),one=True)

@app.get('/api/vendor/setup-info')
def vendor_setup_info():
    v=vendor_from_token(request.headers.get('X-Vendor-Token',''))
    if not v: return jsonify(error='Registration session expired.'),401
    return jsonify(name=v['name_en'],phone=v['phone'],email=v['email'])

@app.post('/api/vendor/set-password')
def vendor_set_password():
    d=request.get_json(silent=True) or {}
    v=vendor_from_token(d.get('vendor_token'))
    password=d.get('password') or ''
    if not v: return jsonify(error='Registration session expired. Please contact support.'),401
    if len(password)<8: return jsonify(error='Password must contain at least 8 characters.'),400
    execute("UPDATE vendors SET password_hash=%s WHERE id=%s",(generate_password_hash(password),v['id']))
    return jsonify(ok=True)

@app.post('/api/vendor/login')
def vendor_login():
    d=request.get_json(silent=True) or {}
    identity=clean(d.get('identity'),150).lower()
    password=d.get('password') or ''
    if not identity or not password: return jsonify(error='Enter your phone number/email and password.'),400
    v=query("SELECT id,password_hash FROM vendors WHERE LOWER(email)=%s OR phone=%s LIMIT 1",(identity,identity),one=True)
    if not v or not v.get('password_hash') or not check_password_hash(v['password_hash'],password):
        return jsonify(error='Invalid login details.'),401
    token=secrets.token_urlsafe(40)
    execute("UPDATE vendors SET access_token_hash=%s WHERE id=%s",(hashlib.sha256(token.encode()).hexdigest(),v['id']))
    return jsonify(ok=True,vendor_token=token,vendor_id=v['id'])

@app.post('/api/vendor/upload-aadhaar')
def vendor_upload_aadhaar():
    token=request.headers.get('X-Vendor-Token','')
    v=vendor_from_token(token)
    if not v: return jsonify(error='Please log in again.'),401
    paid=query("SELECT id FROM payments WHERE vendor_id=%s AND status='paid' ORDER BY id DESC LIMIT 1",(v['id'],),one=True)
    if not paid: return jsonify(error='Complete your subscription payment before uploading your document.'),403
    if not request.form.get('consent'): return jsonify(error='Please confirm consent before submitting your document.'),400
    uploaded=request.files.get('aadhaar_document')
    if not uploaded or not uploaded.filename: return jsonify(error='Choose an Aadhaar image or PDF.'),400
    try:
        save_private_proof(uploaded,v['id'],'Aadhaar document')
    except ValueError as e:
        return jsonify(error=str(e)),400
    execute("UPDATE vendors SET verification_status='pending',status='pending' WHERE id=%s",(v['id'],))
    return jsonify(ok=True,message='Document submitted. The ShubhaVedika team will review it securely.')

# Admin endpoints
@app.post('/api/admin/login')
def admin_login():
    d=request.get_json(silent=True) or {}; u=query('SELECT * FROM admins WHERE username=%s',(clean(d.get('username'),60),),one=True)
    if not u:
        ensure_admin(); u=query('SELECT * FROM admins WHERE username=%s',(clean(d.get('username'),60),),one=True)
    if u and check_password_hash(u['password_hash'],d.get('password','')):
        session.clear(); session['admin']=u['username']; return jsonify(ok=True)
    return jsonify(error='Invalid username or password'),401
@app.post('/api/admin/logout')
def admin_logout(): session.clear(); return jsonify(ok=True)

@app.get('/api/admin/stats')
@admin_required
def admin_stats():
    s=query("SELECT (SELECT COUNT(*) FROM vendors WHERE status='active') active_vendors,(SELECT COUNT(*) FROM vendors WHERE status='pending') pending_vendors,(SELECT COUNT(*) FROM enquiries) total_enquiries,(SELECT COUNT(*) FROM enquiries WHERE status='new') new_enquiries,(SELECT COUNT(*) FROM reviews WHERE approved=0) pending_reviews,(SELECT COUNT(*) FROM vendors WHERE verification_status='pending') pending_verification",one=True)
    by_cat=query('SELECT cat.name_en label,COUNT(v.id) n FROM categories cat LEFT JOIN vendors v ON v.category_id=cat.id GROUP BY cat.id ORDER BY n DESC')
    by_city=query('SELECT c.name_en label,COUNT(v.id) n FROM cities c LEFT JOIN vendors v ON v.city_id=c.id GROUP BY c.id HAVING n>0 ORDER BY n DESC LIMIT 10')
    recent=query('SELECT e.*,v.name_en vendor FROM enquiries e LEFT JOIN vendors v ON v.id=e.vendor_id ORDER BY e.id DESC LIMIT 8')
    return jsonify(stats=s,by_cat=by_cat,by_city=by_city,recent=recent)

@app.get('/api/admin/vendors')
@admin_required
def admin_vendors():
    expire_due_plans()
    return jsonify(items=query(ADMIN_VENDOR_SELECT+' ORDER BY v.id DESC'))
@app.get('/api/admin/vendors/<int:vid>/documents')
@admin_required
def admin_vendor_documents(vid): return jsonify(items=query('SELECT id,document_type,original_name,created_at FROM vendor_documents WHERE vendor_id=%s ORDER BY id DESC',(vid,)))
@app.get('/api/admin/documents/<int:doc_id>')
@admin_required
def admin_document_file(doc_id):
    d=query('SELECT storage_name,original_name FROM vendor_documents WHERE id=%s',(doc_id,),one=True)
    if not d: abort(404)
    path=os.path.join(PRIVATE_UPLOAD_DIR,os.path.basename(d['storage_name']))
    if not os.path.isfile(path): abort(404)
    return send_file(path,as_attachment=False,download_name=d['original_name'])
@app.patch('/api/admin/vendors/<int:vid>/verification')
@admin_required
def admin_vendor_verification(vid):
    d=request.get_json(silent=True) or {}; status=d.get('status')
    if status not in ('verified','rejected','pending'): return jsonify(error='Invalid verification status'),400
    execute("UPDATE vendors SET verification_status=%s,verification_notes=%s,verified_at=IF(%s='verified',UTC_TIMESTAMP(),NULL),verified_by=%s,status=CASE WHEN %s='verified' AND plan_status='active' THEN 'active' WHEN %s='rejected' THEN 'hidden' ELSE 'pending' END WHERE id=%s",
            (status,clean(d.get('notes'),1000),status,session['admin'],status,status,vid))
    return jsonify(ok=True)
@app.post('/api/admin/vendors')
@admin_required
def admin_vendor_add():
    f=request.form; val=vendor_values(f,save_public_image(request.files.get('image')))
    vid=execute("INSERT INTO vendors (name_en,name_te,category_id,city_id,locality,description_en,description_te,price_from,price_unit,phone,whatsapp,email,image,status,plan_status) VALUES (%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,'active','active')",val)
    return jsonify(id=vid),201
@app.put('/api/admin/vendors/<int:vid>')
@admin_required
def admin_vendor_edit(vid):
    old=query('SELECT image FROM vendors WHERE id=%s',(vid,),one=True)
    if not old:return jsonify(error='Not found'),404
    val=vendor_values(request.form,save_public_image(request.files.get('image')) or old['image'])
    execute('UPDATE vendors SET name_en=%s,name_te=%s,category_id=%s,city_id=%s,locality=%s,description_en=%s,description_te=%s,price_from=%s,price_unit=%s,phone=%s,whatsapp=%s,email=%s,image=%s WHERE id=%s',val+(vid,))
    return jsonify(ok=True)
@app.delete('/api/admin/vendors/<int:vid>')
@admin_required
def admin_vendor_del(vid): execute('DELETE FROM vendors WHERE id=%s',(vid,)); return jsonify(ok=True)

@app.get('/api/admin/enquiries')
@admin_required
def admin_enquiries(): return jsonify(items=query('SELECT e.*,v.name_en vendor FROM enquiries e LEFT JOIN vendors v ON v.id=e.vendor_id ORDER BY e.id DESC'))
@app.get('/api/admin/reviews')
@admin_required
def admin_reviews(): return jsonify(items=query('SELECT r.*,v.name_en vendor FROM reviews r JOIN vendors v ON v.id=r.vendor_id ORDER BY r.approved,r.id DESC'))
@app.patch('/api/admin/reviews/<int:rid>')
@admin_required
def admin_review_approve(rid): execute('UPDATE reviews SET approved=%s WHERE id=%s',(1 if (request.get_json(silent=True) or {}).get('approved') else 0,rid)); return jsonify(ok=True)
@app.delete('/api/admin/reviews/<int:rid>')
@admin_required
def admin_review_del(rid): execute('DELETE FROM reviews WHERE id=%s',(rid,)); return jsonify(ok=True)

TABLES={'cities':('name_en','name_te','slug','district','latitude','longitude'),'categories':('name_en','name_te','slug','icon','is_venue')}
@app.get('/api/admin/<table>')
@admin_required
def admin_list_simple(table):
    if table not in TABLES:return jsonify(error='Not found'),404
    return jsonify(items=query(f'SELECT * FROM {table} ORDER BY id'))
@app.post('/api/admin/<table>')
@admin_required
def admin_add_simple(table):
    if table not in TABLES:return jsonify(error='Not found'),404
    d=request.get_json(silent=True) or {}; d['slug']=slugify(d.get('slug') or d.get('name_en','')); cols=TABLES[table]
    vals=[d.get(c,0 if c=='is_venue' else None if c in ('latitude','longitude') else '') for c in cols]
    if not d.get('name_en') or not d.get('name_te'):return jsonify(error='English and Telugu names are required'),400
    try:i=execute(f"INSERT INTO {table} ({','.join(cols)}) VALUES ({','.join(['%s']*len(cols))})",vals)
    except pymysql.err.IntegrityError:return jsonify(error='Already exists'),400
    return jsonify(id=i),201
@app.delete('/api/admin/<table>/<int:i>')
@admin_required
def admin_del_simple(table,i):
    if table not in TABLES:return jsonify(error='Not found'),404
    try:execute(f'DELETE FROM {table} WHERE id=%s',(i,))
    except pymysql.err.IntegrityError:return jsonify(error='Cannot delete: records are using this item'),400
    return jsonify(ok=True)

def ensure_admin():
    with app.app_context():
        if not Config.ADMIN_USERNAME or not Config.ADMIN_PASSWORD:
            print('[setup] ADMIN_USERNAME and ADMIN_PASSWORD must be set before creating the first admin')
            return
        if not query('SELECT id FROM admins LIMIT 1',one=True):
            execute('INSERT INTO admins (username,password_hash) VALUES (%s,%s)',(Config.ADMIN_USERNAME,generate_password_hash(Config.ADMIN_PASSWORD)))
            print('[setup] Admin created from environment credentials')

if __name__=='__main__':
    ensure_admin(); app.run(debug=False,port=5000)
