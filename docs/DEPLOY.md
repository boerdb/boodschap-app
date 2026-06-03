# Boodschappenlijst — deploy (med-track-pwa patroon)

## Architectuur

- **Next.js** → lokaal `npm run dev` of server NEXT (`192.168.1.32`)
- **MariaDB** → server DB (`192.168.1.14`) → database `boodschap`
- App praat via `DATABASE_URL` + `mysql2` (geen PHP vereist)

```
Telefoon / PC → Next.js → mysql2 → MariaDB op 192.168.1.14
```

## 1. Database installeren

Op je PC (met `paramiko`: `pip install paramiko`):

```bash
python scripts/setup_database.py
```

Of handmatig in phpMyAdmin: voer [`sql/schema.sql`](../sql/schema.sql) uit en maak user `boodschap` met grants.

## 2. Omgevingsvariabelen

```bash
cp .env.example .env.local
```

Vul in:

```env
DATABASE_URL=mysql://boodschap:JOUW_WACHTWOORD@192.168.1.14:3306/boodschap
NODE_ENV=development
APP_TIMEZONE=Europe/Amsterdam
```

Zonder `DATABASE_URL` draait de app in **demo-modus** (in-memory).

## 3. Starten

```bash
npm install
npm run dev
```

Productie:

```bash
npm run build
npm run start
```

## 4. Controleren

```bash
python scripts/diagnose_db.py
```

## Deploy naar server NEXT (192.168.1.32)

```bash
git push origin main
python scripts/deploy_pull.py
```

App draait op **poort 3008** via PM2 (`boodschap-app`) in `/var/www/boodschap-app`.

## Optioneel: PHP-API op 192.168.1.52

De map [`server/php/`](../server/php/) blijft beschikbaar als je de oude PHP-laag wilt. Standaard gebruikt Next.js direct MariaDB via `DATABASE_URL`.
