# poggiocivitate.net Server Guide

A walkthrough for maintaining and updating the poggiocivitate.net server.

> **Note on history:** the site originally ran on a Bitnami LAMP stack on AWS
> Lightsail. Because AWS is deprecating the Bitnami blueprints, and because the
> bundled Bitnami Apache could not run the project's PHP and Node components
> cleanly, the site was migrated to a plain **Ubuntu** instance running the
> **system Apache** with **Certbot** for SSL. This guide describes that current
> setup. Old Bitnami paths (`/opt/bitnami/...`) and the `bncert-tool` no longer
> apply.

---

## Overview of the current stack

- **OS:** Ubuntu (AWS Lightsail, OS-only instance)
- **Web server:** system Apache (`/etc/apache2/...`), serving over HTTP and HTTPS
- **Web root:** `/var/www/html` - a flat checkout of the `static-web-showing`
  repo, so each project folder resolves at `poggiocivitate.net/<folder>/`
- **SSL:** Let's Encrypt via Certbot, auto-renewing
- **Backend:** a single NestJS service on **port 3001** behind the Apache `/api`
  proxy, serving every endpoint (trench book reader, map photo points, and
  Cassetta search). The formerly separate port-3000 reader process has been
  merged into this one project.
- **Swap:** a swap file is configured because the instance has limited RAM
- **Node:** Node 20 LTS, installed from NodeSource

---

## Projects on this server

All folders sit directly under `/var/www/html`:

| Folder | Served at | What it is |
|---|---|---|
| `projects/` | `/projects/` (site homepage) | landing page |
| `coords/` | `/coords/` | coordinate converter (static, proj4js) |
| `reader/` | `/reader/` | trench book viewer (static frontend; endpoints now live in the unified API) |
| `map/` | `/map/` | MapLibre map, plus a basic-auth `admin.html` editor |
| `mag-search/` | `/mag-search/` | Cassetta catalog search frontend |
| `api/` | `/api/...` | unified backend: trench-book, photos, and cassetta (Node, port 3001) |
| `2dgallery/` | `/2dgallery/...` | 2D Illustration Gallery with Tags |
| `3dgallery/` | `/3dgallery/...` | 3D Model Viewer |
| `oc-search/` | `/oc-search/...` | Modified search functionality for Open Context |


There is now a **single** Node backend (`api/`) serving all endpoints on port
3001. The `reader/` folder is the trench book viewer's static frontend; its
former standalone API was merged into the unified project. Apache proxies all of
`/api` to the one service (see Part 6).

---

## Part 1: Connect to the server

SSH in as the `ubuntu` user (substitute the key path and IP):

```bash
ssh -i ~/Downloads/your-key.pem ubuntu@your-server-ip
```

> The login user is `ubuntu`, not `bitnami`. The session starts in
> `/home/ubuntu`.

---

## Part 2: Update the website

The site content is a Git checkout under the web root. The helper script
`pull.sh` in `/home/ubuntu/` cds into the web root and runs `git pull`.

```bash
cd /home/ubuntu
./pull.sh
```

Manual equivalent:

```bash
cd /var/www/html
git pull
```

> A plain `git pull` updates static files only. After pulling changes to either
> Node project, that project must be rebuilt and its service restarted (Part 6).
> Files ignored by git (map tiles, the photo database, node dist and modules) are never touched by a
> pull.

---

## Part 3: Point a domain (or subdomain) at the server

1. In the registrar's DNS settings, add an **A record**:

   | Field | Value |
   |---|---|
   | Type | A |
   | Name | `@` for the apex, or a label like `www` / `map` for a subdomain |
   | Value | the server's static IP |
   | TTL | 3600 or Automatic |

2. Allow a few minutes for DNS to propagate.

3. Confirm resolution before configuring Apache:

   ```bash
   dig +short poggiocivitate.net
   ```

> Always use the Lightsail **static IP** so the address survives a reboot.

---

## Part 4: HTTPS with Certbot

SSL is managed by Certbot (not the old Bitnami tool). The certificate currently
covers `poggiocivitate.net` and `www.poggiocivitate.net` and renews
automatically.

To issue or expand the certificate (for example after adding a subdomain), list
every domain it should cover and force them into one certificate lineage:

```bash
sudo certbot --apache -d poggiocivitate.net -d www.poggiocivitate.net --cert-name poggiocivitate.net
```

Certbot writes the SSL directives into the Apache vhost automatically. Useful
checks:

```bash
#list certificates, their domains, and expiry
sudo certbot certificates

#confirm which cert a name actually serves
echo | openssl s_client -connect poggiocivitate.net:443 -servername poggiocivitate.net 2>/dev/null | openssl x509 -noout -subject -ext subjectAltName
```

> Only add a domain to the certificate after its DNS record resolves to this
> server, or validation fails with an NXDOMAIN error.

---

## Part 5: Clean URLs and the homepage

Folders resolve to their `index.html` via Apache's `DirectoryIndex`, and
`AllowOverride All` in the vhost lets each project use a `.htaccess` if needed.

The simpliest thing to do, if your html is named `index.html`, links should point to the **folder** 
and not the file. If your html is not named index.html, you should put it in it's own folder and change it's name
to `index.html`.

The domain root redirects to the landing page. In both vhost files
(`000-default.conf` and `000-default-le-ssl.conf`) the rule is:

```apache
RedirectMatch ^/$ /projects/
```

After editing any Apache config, test and reload:

```bash
sudo apache2ctl configtest
sudo systemctl reload apache2
```

---

## Part 6: The backend API (Node)

One NestJS service now serves every dynamic endpoint. It runs locally and is
reached through Apache; it is not meant to be hit directly from the public
internet, and the Lightsail firewall opens only 22, 80, and 443.

| | unified API |
|---|---|
| repo folder | `/var/www/html/api` |
| systemd unit | `dig-map-api` |
| listens on | `127.0.0.1:3001` (via `API_PORT`, fallback 3001) |
| build | `npm run build` |
| routes | `/trench-book/...`, `/photos`, `/cassetta/...` |


> The old separate reader process on port 3000 and its `trench-reader` unit are
> gone. If a `trench-reader` service still exists on the box, it is now redundant
> and should be stopped and disabled:
> `sudo systemctl disable --now trench-reader`. Confirm nothing still listens on
> 3000 with `sudo ss -tlnp | grep 3000`.

### The Apache proxy

With a single backend, all of `/api` proxies to the one port. The earlier
path-split rules (cassetta/photos before a reader catch-all) are no longer
needed. Both sides of the rule must end with a slash, or a double-slash 404
results.

```apache
ProxyPreserveHost On

#unified API on port 3001 - serves trench-book, photos, and cassetta
ProxyPass        /api/ http://127.0.0.1:3001/
ProxyPassReverse /api/ http://127.0.0.1:3001/
```

Inspect what is currently live with:

```bash
grep -rn -i proxy /etc/apache2/sites-enabled/
```

> If old rules pointing at 3000 are still present, remove them so every `/api`
> request lands on 3001.

### systemd unit

`/etc/systemd/system/dig-map-api.service`:

```ini
[Unit]
Description=Poggio Civitate API (trench-book, photos, cassetta)
After=network.target

[Service]
Type=simple
User=www-data
WorkingDirectory=/var/www/html/api
ExecStart=/usr/bin/node dist/main.js
Restart=on-failure
RestartSec=5
Environment=NODE_ENV=production
Environment=API_PORT=3001
Environment=CASSETTA_SERVICE_ACCOUNT=/var/lib/magsearch/service_account.json
Environment=CASSETTA_CACHE_FILE=/var/lib/magsearch/cassetta_index.json
#Environment=PHOTO_DB=/var/lib/digmap/photos.db
#Environment=PHOTO_EDIT_TOKEN=changeme
```

> The trench-book endpoints read files from the reader's `public/` directory.
> After the merge, confirm the unified app can still find that content from its
> `WorkingDirectory`; if the reader's `public/OCdata.json` and `trench-books/`
> moved during the merge, the paths inside the app or an env var must point at
> their new home.

### Support files that live outside the web root

The API reads files that must not be web-downloadable or overwritten by
`git pull`:

- the photo points SQLite database (used by the photos endpoints)
- the Google service-account key and the Cassetta index cache

**Important permission gotcha:** these were first placed under
`/home/ubuntu/...`, but Ubuntu creates `/home/ubuntu` as mode `750`, so the
`www-data` service user cannot traverse *into* it and the API fails with
`EACCES` no matter how the individual files are chmodded. Do not
`chmod o+x /home/ubuntu` (that exposes the whole home directory). The clean fix
is to keep these files somewhere the service user can reach, owned by that user:

```bash
sudo mkdir -p /var/lib/magsearch /var/lib/digmap
sudo mv service_account.json /var/lib/magsearch/
sudo chown -R www-data:www-data /var/lib/magsearch /var/lib/digmap
sudo chmod 600 /var/lib/magsearch/service_account.json
```

The systemd env vars above already point at `/var/lib/...` to match. The Google
Drive folder must also be shared with the `client_email` inside the
service-account json, or Cassetta searches return empty.

### The map editor page (basic auth)

`map/admin.html` sits behind HTTP basic auth as a first gate (the API token is
the second). In the vhost:

```apache
<Directory /var/www/html/map>
  <Files "admin.html">
    AuthType Basic
    AuthName "Photo editor"
    AuthUserFile /etc/apache2/.htpasswd-digmap
    Require valid-user
  </Files>
</Directory>
```

Create or add a user:

```bash
sudo htpasswd -c /etc/apache2/.htpasswd-digmap boss   #-c creates; omit -c to add more
```

Only share the editor credentials over HTTPS, since basic-auth headers are sent
on every request.

### Redeploying after a code change

The compiled `dist/` is what actually runs, so pulling new source is not enough;
it must be rebuilt and the service restarted:

```bash
cd /var/www/html/api
npm install
NODE_OPTIONS="--max-old-space-size=1024" npm run build
sudo systemctl restart dig-map-api
```

---

## Part 7: Rebuilding a fresh instance from scratch

If the box ever has to be recreated, install the prerequisites before the app
builds:

```bash
#node 20 LTS
curl -fsSL https://deb.nodesource.com/setup_20.x | sudo -E bash -
sudo apt install -y nodejs

#apache modules used by the proxy, auth, and rewrites
sudo a2enmod proxy proxy_http headers ssl rewrite

#build tools and support libraries
sudo apt install -y build-essential apache2-utils sqlite3
```

> `build-essential` matters: the photos module's `better-sqlite3` compiles a
> native addon during `npm install` and fails without `make`. Installing it up
> front avoids a mid-install error.

Then set up swap (Part 8), build each Node app (Part 6), recreate the systemd
units, restore the support files (Part 6), and reissue the certificate (Part 4).

---

## Part 8: Swap (low-memory instance)

The instance has little RAM, so a swap file keeps installs and builds from being
killed by the kernel. It already exists and persists across reboots via
`/etc/fstab`. Confirm swap is active:

```bash
free -h
```

To recreate it on a fresh instance:

```bash
sudo fallocate -l 3G /swapfile
sudo chmod 600 /swapfile
sudo mkswap /swapfile
sudo swapon /swapfile
echo '/swapfile none swap sw 0 0' | sudo tee -a /etc/fstab
```

---

## Part 9: Restarting and resetting

Prefer the narrowest restart that fixes the problem. Reach for a full reboot
only as a last resort.

```bash
#reload Apache after a config change (no dropped connections)
sudo systemctl reload apache2

#restart a single service
sudo systemctl restart apache2
sudo systemctl restart dig-map-api

#full instance reboot - last resort only
sudo reboot
```

After a reboot, confirm the pieces came back:

```bash
free -h                              #swap active again
systemctl is-active apache2 dig-map-api
sudo ss -tlnp | grep 3001             #the Node service listening
```

Both services (apache2 and dig-map-api) are enabled, so they start automatically
on boot; a reboot should not require any manual restart. If one is not `active`, inspect it with
`journalctl -u <service> -n 50`.

---

## Part 10: Periodic maintenance tasks

**Refresh the Cassetta index** after the Google Drive catalog changes:

```bash
curl -X POST http://127.0.0.1:3001/cassetta/refresh
journalctl -u dig-map-api -f   #watch for: index rebuilt: N objects, M sheets
```

**Import photo points** from a QGIS export (one-time or occasional):

```bash
#on the desktop
ogr2ogr -f GeoJSON -t_srs EPSG:4326 photo_points.geojson dig.gpkg photo_points
scp photo_points.geojson ubuntu@server:/var/www/html/api/

#on the server (import upserts by id, safe to re-run)
cd /var/www/html/api
node scripts/import_photos.mjs photo_points.geojson /var/lib/digmap/photos.db
sudo systemctl restart dig-map-api
```

**Upload map tiles** (pmtiles are gitignored, so they travel by scp, not git):

```bash
scp local.pmtiles ubuntu@server:/var/www/html/map/tiles/
```

---

## Key files and commands

| Path / Command | Description |
|---|---|
| `/var/www/html/` | Web root; project folders live here directly |
| `/var/www/html/reader/` | Trench book reader (static frontend) |
| `/var/www/html/api/` | Unified backend API (trench-book, photos, cassetta, port 3001) |
| `/etc/apache2/sites-available/000-default.conf` | HTTP virtualhost |
| `/etc/apache2/sites-available/000-default-le-ssl.conf` | HTTPS virtualhost (SSL, proxy, redirects, auth) |
| `/etc/apache2/apache2.conf` | Main Apache config (global `Directory` rules) |
| `/etc/apache2/.htpasswd-digmap` | Basic-auth users for the map editor |
| `/var/lib/magsearch/`, `/var/lib/digmap/` | API support files outside the web root |
| `/var/log/apache2/error.log` | Apache error log |
| `sudo apache2ctl configtest` | Check Apache config before reloading |
| `sudo systemctl reload apache2` | Reload Apache after config changes |
| `sudo certbot certificates` | List SSL certificates and expiry |
| `sudo certbot --apache -d ... --cert-name poggiocivitate.net` | Issue or expand the SSL certificate |
| `/home/ubuntu/pull.sh` | Update the website from GitHub (cd to web root, git pull) |
| `sudo systemctl restart dig-map-api` | Restart the unified backend API |
| `journalctl -u <service> -f` | Follow a service's logs live |
| `sudo ss -tlnp \| grep 3001` | Confirm the backend API is listening |
| `free -h` | Check memory and swap |
| `sudo reboot` | Full instance restart (last resort) |