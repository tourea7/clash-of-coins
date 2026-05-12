# 🪙 Clash of Coins — Guide de Déploiement Complet

> **Joue. Gagne. Domine.** — Ludo compétitif avec portefeuille Mobile Money

---

## 📁 Structure du projet

```
clash-of-coins/
├── public/
│   ├── index.html        ← Frontend (tout le jeu)
│   └── js/
│       └── game.js       ← Logique du jeu + Socket.io client
├── server.js             ← Backend Node.js
├── schema.sql            ← Base de données Supabase
├── package.json
├── .env                  ← Variables d'environnement (à créer)
└── README.md
```

---

## ⚡ Démarrage rapide (local, 5 minutes)

### 1. Installer Node.js
Télécharger sur https://nodejs.org (version 18+)

### 2. Installer les dépendances
```bash
cd clash-of-coins
npm install
```

### 3. Créer le fichier `.env`
```bash
# Copier ce contenu dans un fichier appelé .env
PORT=3000
SUPABASE_URL=https://TON_PROJET.supabase.co
SUPABASE_ANON_KEY=ta_cle_anon_ici
```

### 4. Lancer le serveur
```bash
npm run dev
```

### 5. Ouvrir le jeu
Aller sur http://localhost:3000 dans ton navigateur 🎉

---

## 🗄️ Configuration Supabase (Base de données gratuite)

### Étape 1 — Créer un compte
1. Aller sur https://supabase.com
2. Cliquer "Start your project" → "Sign Up"
3. Créer un nouveau projet (choisir une région proche: Europe West)

### Étape 2 — Créer la base de données
1. Dans Supabase: cliquer sur "SQL Editor" dans le menu gauche
2. Copier-coller tout le contenu de `schema.sql`
3. Cliquer "Run"
4. ✅ Toutes les tables sont créées!

### Étape 3 — Récupérer les clés API
1. Dans Supabase: cliquer "Settings" → "API"
2. Copier "Project URL" → mettre dans `.env` comme `SUPABASE_URL`
3. Copier "anon public" key → mettre dans `.env` comme `SUPABASE_ANON_KEY`

---

## 🚀 Mise en ligne (gratuite)

### Option A — Railway (Recommandé, le plus simple)

**Railway héberge le backend + frontend ensemble.**

1. Créer un compte sur https://railway.app
2. Cliquer "New Project" → "Deploy from GitHub repo"
3. Connecter ton compte GitHub et pousser ton code:
   ```bash
   git init
   git add .
   git commit -m "Initial commit — Clash of Coins"
   git remote add origin https://github.com/TON_USERNAME/clash-of-coins.git
   git push -u origin main
   ```
4. Dans Railway: sélectionner ton repo
5. Ajouter les variables d'environnement:
   - `SUPABASE_URL` = ton URL Supabase
   - `SUPABASE_ANON_KEY` = ta clé Supabase
   - `PORT` = 3000
6. Railway génère une URL comme `clash-of-coins.up.railway.app`
7. ✅ Ton jeu est en ligne!

**Coût: Gratuit jusqu'à 500h/mois (largement suffisant pour démarrer)**

---

### Option B — Render (Alternative gratuite)

1. Créer un compte sur https://render.com
2. "New" → "Web Service"
3. Connecter ton repo GitHub
4. Configurer:
   - **Build Command:** `npm install`
   - **Start Command:** `node server.js`
5. Ajouter les variables d'environnement
6. ✅ URL générée automatiquement

---

### Option C — VPS (Pour plus de contrôle)

Si tu veux un domaine `.ci` professionnel:

```bash
# Sur un VPS Ubuntu (OVH, DigitalOcean, etc.)

# Installer Node.js
curl -fsSL https://deb.nodesource.com/setup_18.x | sudo -E bash -
sudo apt install -y nodejs

# Installer PM2 (garde le serveur allumé 24/7)
npm install -g pm2

# Cloner et démarrer
git clone https://github.com/TON_USERNAME/clash-of-coins.git
cd clash-of-coins
npm install
pm2 start server.js --name "clash-of-coins"
pm2 startup  # démarrage automatique au reboot
pm2 save

# Installer Nginx pour le domaine
sudo apt install nginx
```

```nginx
# /etc/nginx/sites-available/clashofcoins.ci
server {
    listen 80;
    server_name clashofcoins.ci www.clashofcoins.ci;

    location / {
        proxy_pass http://localhost:3000;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_cache_bypass $http_upgrade;
    }
}
```

```bash
# Activer le site
sudo ln -s /etc/nginx/sites-available/clashofcoins.ci /etc/nginx/sites-enabled/
sudo nginx -t && sudo systemctl reload nginx

# HTTPS gratuit avec Let's Encrypt
sudo apt install certbot python3-certbot-nginx
sudo certbot --nginx -d clashofcoins.ci -d www.clashofcoins.ci
```

---

## 💳 Intégration Mobile Money (Phase 2)

### Orange Money CI
```javascript
// Dans server.js, remplacer la simulation par:
const axios = require('axios');

async function orangeMoneyPay(phone, amount, reference) {
  const response = await axios.post(
    'https://api.orange.com/orange-money-webpay/ci/v1/webpayment',
    {
      merchant_key: process.env.ORANGE_MERCHANT_KEY,
      currency: 'OUV',
      order_id: reference,
      amount: amount,
      return_url: `${process.env.APP_URL}/payment/success`,
      cancel_url: `${process.env.APP_URL}/payment/cancel`,
      notif_url: `${process.env.APP_URL}/api/webhook/orange`,
      lang: 'fr',
      reference: reference,
    },
    { headers: { Authorization: `Bearer ${process.env.ORANGE_ACCESS_TOKEN}` }}
  );
  return response.data;
}
```

### Wave CI
```javascript
// API Wave
async function wavePayment(phone, amount) {
  const response = await axios.post(
    'https://api.wave.com/v1/checkout/sessions',
    {
      amount: amount.toString(),
      currency: 'XOF',
      client_reference: `COC_${Date.now()}`,
      success_url: `${process.env.APP_URL}/payment/success`,
      error_url: `${process.env.APP_URL}/payment/error`,
    },
    { headers: { Authorization: `Bearer ${process.env.WAVE_SECRET_KEY}` }}
  );
  return response.data;
}
```

**Pour obtenir les clés API:**
- Orange Money: https://developer.orange.com → s'inscrire en tant que marchand
- Wave: https://wave.com/en/business → compte Business
- MTN MoMo: https://momodeveloper.mtn.com → créer une app sandbox

---

## 📱 Transformer en App Mobile (PWA)

Le jeu est déjà une PWA (Progressive Web App). Pour l'installer:

1. Créer le fichier `public/manifest.json`:
```json
{
  "name": "Clash of Coins",
  "short_name": "Clash",
  "description": "Ludo compétitif avec Mobile Money",
  "start_url": "/",
  "display": "standalone",
  "background_color": "#09090f",
  "theme_color": "#D4AF37",
  "orientation": "portrait",
  "icons": [
    { "src": "/icons/icon-192.png", "sizes": "192x192", "type": "image/png" },
    { "src": "/icons/icon-512.png", "sizes": "512x512", "type": "image/png" }
  ]
}
```

2. Créer `public/sw.js` (Service Worker pour hors-ligne):
```javascript
const CACHE = 'clash-v1';
const ASSETS = ['/', '/js/game.js'];
self.addEventListener('install', e => e.waitUntil(
  caches.open(CACHE).then(c => c.addAll(ASSETS))
));
self.addEventListener('fetch', e => e.respondWith(
  caches.match(e.request).then(r => r || fetch(e.request))
));
```

3. Sur Android: ouvrir le site dans Chrome → menu ⋮ → "Ajouter à l'écran d'accueil"
4. Sur iPhone: Safari → bouton partage → "Sur l'écran d'accueil"

**Pour publier sur Google Play Store:** utiliser Capacitor ou PWABuilder (https://pwabuilder.com)

---

## 🔐 Sécurité (Important pour l'argent réel)

```bash
# Installer les dépendances de sécurité
npm install helmet express-rate-limit jsonwebtoken bcryptjs
```

```javascript
// Ajouter dans server.js
const helmet = require('helmet');
const rateLimit = require('express-rate-limit');

app.use(helmet());
app.use(rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 100, // max 100 requêtes par IP
  message: 'Trop de requêtes, réessayez plus tard'
}));

// Valider TOUTES les mises côté serveur
// Ne JAMAIS faire confiance aux données du client pour les coins
```

---

## 📊 Variables d'environnement complètes

```env
# Serveur
PORT=3000
NODE_ENV=production
APP_URL=https://clashofcoins.ci

# Supabase
SUPABASE_URL=https://xxxxx.supabase.co
SUPABASE_ANON_KEY=eyJhbGc...
SUPABASE_SERVICE_ROLE_KEY=eyJhbGc...  # Pour les opérations admin

# Orange Money
ORANGE_MERCHANT_KEY=ton_merchant_key
ORANGE_ACCESS_TOKEN=ton_access_token

# Wave
WAVE_SECRET_KEY=wave_sn_prod_...

# MTN MoMo
MTN_MOMO_API_KEY=ton_api_key
MTN_MOMO_ENV=production

# Sécurité
JWT_SECRET=une_chaine_aleatoire_tres_longue_et_secrete_123456
```

---

## 💰 Obtenir une licence de jeu (Côte d'Ivoire)

Pour accepter de l'argent réel légalement:

1. **Créer une société** (SARL minimum, capital 100 000 FCFA)
2. **Contacter l'ARTP** (Autorité de Régulation des Télécommunications et de la Poste)
3. **Déposer une demande de licence** pour "jeux en ligne"
4. **Partenariat avec les opérateurs Mobile Money** (nécessite numéro RCCM + déclaration fiscale)

**Conseil:** Démarrer avec la version coins virtuels (sans argent réel) pour tester le marché, puis régulariser avec les licences nécessaires.

---

## 🎯 Prochaines fonctionnalités à développer

- [ ] Authentification réelle (Google, SMS OTP)
- [ ] Chat en temps réel dans les parties
- [ ] Amis & invitations
- [ ] Animations avancées (PixiJS)
- [ ] Son & musique
- [ ] Tournois automatisés
- [ ] Classement hebdomadaire/mensuel
- [ ] Notifications push
- [ ] Admin dashboard (gestion des joueurs, finances)
- [ ] Intégration Mobile Money réelle
- [ ] KYC (vérification identité joueurs)
- [ ] App Android native (Capacitor)

---

## 📞 Support

Des questions? Ouvre une conversation avec Claude et demande:
- "Comment intégrer Orange Money dans Clash of Coins?"
- "Comment déployer sur Railway pas à pas?"
- "Ajoute le chat en temps réel au jeu"

---

*Clash of Coins v1.0 — Fait avec ❤️ pour la Côte d'Ivoire*
