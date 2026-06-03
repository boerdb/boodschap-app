# Boodschappenlijst PWA

Next.js PWA met barcodescanner, Open Food Facts en gedeelde lijst via **MariaDB** (zelfde patroon als [med-track-pwa](C:\DEV\med-track-pwa)).

## Snel starten

### Met database (aanbevolen)

```bash
pip install paramiko
python scripts/setup_database.py
cp .env.example .env.local
# Pas DATABASE_URL-wachtwoord aan in .env.local
npm install
npm run dev
```

### Zonder database (demo)

```bash
npm install
npm run dev
```

Log in met een naam en code **THUIS**.

## Configuratie

| Variabele | Beschrijving |
|-----------|--------------|
| `DATABASE_URL` | `mysql://boodschap:...@192.168.1.14:3306/boodschap` |
| `APP_TIMEZONE` | `Europe/Amsterdam` |

Zie [docs/DEPLOY.md](docs/DEPLOY.md) en [`.env.example`](.env.example).

## Functies

- Barcodescan (native + ZXing)
- Open Food Facts v3
- Gedeelde lijst (polling)
- Licht/donker thema
- Offline wachtrij + Serwist (productie)
- Installatiebanner (Android + iOS) en update-popup
- App-iconen: `npm run icons` (bron: `assets/boodschap-icon-source.svg`)

## Scripts

| Commando | Beschrijving |
|----------|--------------|
| `python scripts/setup_database.py` | Schema + user op 192.168.1.14 |
| `python scripts/diagnose_db.py` | Tabellen controleren |
| `npm run dev` | Ontwikkeling |
| `npm run build` | Productie + service worker |
