# ShubhaVedika – Wedding Vendor Marketplace

Flask + MySQL application for a Telugu wedding marketplace.

## Vendor onboarding flow

1. Vendor fills in business details and chooses a subscription plan.
2. Razorpay checkout collects payment.
3. After payment confirmation, the vendor uploads an Aadhaar image or PDF.
4. The vendor creates a password for future login.
5. The vendor can sign in using the registered mobile number or email and password.
6. The document is stored privately (not under `/static`) and appears only in the admin verification area.
7. Admin reviews the document and the vendor independently. Payment does **not** mean identity verification.
8. Admin marks the vendor verified. Only then is the vendor listing activated for public display.

**Important Aadhaar limitation:** This build accepts an Aadhaar photo/PDF and stores it securely for manual review. It does not claim to authenticate an Aadhaar card from an image, and it does not automatically validate a Secure QR Code or contact UIDAI. A visible card image alone is not proof of authenticity. Any automated Aadhaar authentication/offline verification must use an eligible, UIDAI-compliant route and required registration/consent.

## Local setup

1. Create a MySQL database by running `schema.sql` in MySQL Workbench.
2. Create a `.env` file from `.env.example` and fill in the credentials.
3. Install packages: `pip install -r requirements.txt`
4. Run: `python app.py`

## Existing database upgrade

Back up the database first. Run `migration_upgrade.sql` only if the earlier upgrade has not already been applied. It adds `password_hash` for vendor login along with the previous marketplace upgrade columns. If you have already run the earlier migration, run only:

```sql
USE shubhavedika;
ALTER TABLE vendors ADD COLUMN password_hash VARCHAR(255) DEFAULT NULL;
```

Do not run the same `ALTER TABLE` twice.

## Render deployment

- Build command: `pip install -r requirements.txt`
- Start command: `gunicorn app:app`
- Add environment variables from `.env.example` in Render.
- Configure a persistent MySQL database and import `schema.sql` for a fresh install.
- For an existing database, run the applicable migration once.
- Set the Razorpay webhook URL to `https://YOUR-DOMAIN/api/payment/webhook` and configure the same webhook secret in Render.
- Set `SESSION_COOKIE_SECURE=1` in Render so the admin session cookie is sent only over HTTPS.

## Security notes

- Never upload `.env`, database passwords, Razorpay secrets, or private Aadhaar files to Git.
- Private documents live under `instance/private_vendor_proofs`, outside the public static folder.
- Restrict filesystem access and backups; define a retention/deletion policy for Aadhaar documents.
- Obtain explicit consent and confirm the lawful basis and applicable Aadhaar/DPDP requirements before collecting Aadhaar.
- Configure a strong `SECRET_KEY`, admin credentials, and Razorpay secrets in Render environment variables.
- This starter flow provides manual review, not official UIDAI authentication or a guarantee that a submitted Aadhaar image is genuine.


## Premium visual update
- Brand palette: royal blue, gold and white.
- The supplied ShubhaVedika logo is used in customer and admin headers.
- Customer category tiles and hero use real Pexels wedding photography hosted on Pexels CDN. Photo pages are linked below for license/credit reference:
  - https://www.pexels.com/photo/vibrant-indian-wedding-couple-under-mandap-36836726/
  - https://www.pexels.com/photo/happy-newlyweds-at-indian-wedding-24334945/
  - https://www.pexels.com/photo/elegant-indian-bride-in-a-vibrant-wedding-setting-31832874/
  - https://www.pexels.com/photo/traditional-indian-wedding-ceremony-ritual-35872894/
  - https://www.pexels.com/photo/vibrant-indian-wedding-ceremony-with-floral-decor-38721881/
  - https://www.pexels.com/photo/elegant-outdoor-indian-wedding-mandap-decor-39797465/
- Admin can remove vendors from the Vendors tab. Related payment, review and private-document records follow the existing database foreign-key cascade; enquiries are retained as unassigned records.
