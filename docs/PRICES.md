# Prijzen — alles op eigen servers

Geen Apify, geen externe prijs-API’s. Alleen jouw servers:

- **MariaDB** `192.168.1.14` — blijvende opslag (~10 MB dataset + `price_cache`)
- **Redis** `192.168.1.14` — snelle geheugencache (zelfde machine, standaard poort **6379**)
- **Next.js** `192.168.1.32` — API; leest Redis → anders MariaDB
- **Telefoon** — IndexedDB alleen voor offline kopie

## Laagvolgorde bij prijs-opvragen

1. Redis op `.14` (milliseconden, ~10 MB in RAM)  
2. MariaDB `checkjebon_dataset` (bron van waarheid na sync)  
3. Optioneel backup-bestand op Next-server  

## Checkjebon-dataset op MariaDB + Redis

Het volledige bestand staat in één rij:

```sql
boodschap.checkjebon_dataset  (id=1, payload LONGTEXT, ~10 MB)
```

Dagelijks verversen (op de Next-server, schrijft naar `.14`):

```bash
cd /var/www/boodschap-app
npm run sync:prices
```

Cron:

```cron
0 5 * * * cd /var/www/boodschap-app && /usr/bin/node scripts/sync-checkjebon.mjs >> /var/log/boodschap-sync.log 2>&1
```

`npm run sync:prices` schrijft naar **MariaDB én Redis** (als `REDIS_URL` in `.env.local` staat).

In `.env.local` op de Next-server (`.32`):

```env
DATABASE_URL=mysql://boodschap:...@192.168.1.14:3306/boodschap
REDIS_URL=redis://192.168.1.14:6379
```

Met wachtwoord: `redis://:jouwwachtwoord@192.168.1.14:6379`

Optioneel backup-bestand op Next: `PRICE_DATA_BACKUP_FILE=0` om uit te zetten.

Eerste keer ook migratie:

```bash
mysql -u boodschap -p boodschap < sql/migrations/002_prices.sql
mysql -u boodschap -p boodschap < sql/migrations/003_checkjebon_dataset.sql
```

## Zoeken op productnaam

Checkjebon bevat geen EAN. Na scan:

1. Open Food Facts → productnaam  
2. Next.js laadt dataset uit MariaDB (in geheugen, ~10 MB — geen probleem op je server)  
3. Fuzzy match → prijzen per keten (AH, Jumbo, Plus, …)

## Barcode (EAN)

Tabel `price_cache`: gevuld door `npm run sync:ah-eans` (gratis AH-API, alleen vanaf jouw server).

## Offline (PWA)

IndexedDB bewaart per gescand product de laatste prijsquote (max. 7 dagen). Geen 10 MB op de telefoon.

## API (alleen intern netwerk)

| Endpoint | Functie |
|----------|---------|
| `GET /api/boodschap/prices?ean=&name=` | Prijzen |
| `GET /api/boodschap/prices/dataset` | Status dataset (MariaDB vs bestand) |

## Kosten

€0 — alleen je eigen hardware en stroom.
