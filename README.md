# Météo mer

Tableau de bord du vent, des vagues et de la mer pour la côte belge, pensé pour le wingfoil.
Première source : [Meetnet Vlaamse Banken](https://meetnetvlaamsebanken.be) (API V2). D'autres sources peuvent s'ajouter sans toucher à l'interface.

## Lancer

Prérequis : Node.js 18 ou plus récent. Aucune dépendance à installer.

```bash
cp .env.example .env      # puis y mettre l'e-mail et le mot de passe Meetnet
npm start                 # ou : node server.js
# ouvrir http://localhost:8080
```

Sans identifiants, le serveur démarre avec une source de démonstration (données synthétiques).

Compte Meetnet : gratuit, à créer via le bouton « Login » sur meetnetvlaamsebanken.be. Le même compte sert pour le site et l'API.

## Mettre en ligne sur Netlify

1. Pousser ce dossier dans un dépôt GitHub.
2. Sur Netlify : Add new site > Import an existing project > choisir le dépôt. Les réglages sont lus dans `netlify.toml` (rien à saisir).
3. Site configuration > Environment variables : ajouter `MEETNET_USER` et `MEETNET_PASSWORD`, puis relancer un déploiement.
4. Vérifier `https://<votre-site>.netlify.app/api/debug/meetnet` (liste des paramètres reconnus).

L'interface est servie comme page statique ; `/api/overview` est une fonction Netlify qui interroge Meetnet. Le CDN de Netlify garde chaque réponse 5 minutes.

Sur le téléphone : ouvrir l'adresse du site puis « Ajouter à l'écran d'accueil ».

## Ce que montre l'interface

- Tout en haut, les derniers relevés des stations choisies en deux tableaux : vent (moyen, rafales, direction, onshore/offshore, air) et houle (hauteur significative, hauteur des 10 % plus hautes vagues (H1/10), état de la mer selon l'échelle Douglas, période, direction, eau).
- Couleur selon des repères wingfoil (en nœuds) : moins de 8, 8 à 12, 12 à 18 (idéal), 18 à 25, 25 à 32, plus de 32.
- Onshore, side-shore ou offshore, calculé pour la côte belge (mer au nord-ouest).
- Unités au choix : nœuds, m/s, km/h, Beaufort. Actualisation automatique toutes les 5 minutes.
- Choix des stations affichées (mémorisé dans le navigateur), puis l'historique sur 3 h, 6 h, 12 h, 24 h, 48 h, 72 h ou 7 jours (au choix, mémorisé) : d'abord le vent de chaque station (rafales et flèches de direction heure par heure), puis la houle, sur une même échelle pour comparer. Une infobulle donne les valeurs exactes au survol (souris, doigt ou stylet).

## Architecture

```
server.js            serveur local sans dépendance (même API que Netlify), cache 5 min
lib/overview.js      agrégation des sources, commune au serveur local et à Netlify
netlify/functions/   fonctions Netlify : /api/overview et /api/debug/:source
netlify.toml, build.js  configuration et construction pour Netlify
lib/quantities.js    grandeurs communes (vent, vagues, températures…) et conversions d'unités
sources/index.js     registre des sources
sources/meetnet.js   adaptateur Meetnet Vlaamse Banken
sources/demo.js      adaptateur de démonstration (exemple minimal)
public/index.html    interface (HTML, CSS et JS dans un seul fichier)
```

Le serveur garde les identifiants : le navigateur n'y a jamais accès.

### Ajouter une source

1. Créer `sources/<nom>.js` qui exporte par défaut une fonction `(env) => adaptateur`.
2. L'adaptateur fournit `id`, `name`, `url`, `attribution`, `isConfigured()`, `listStations()`, `latest()` et `history(from, to, quantities)`. Le contrat détaillé est en tête de `sources/index.js`.
3. Convertir les valeurs vers les unités de `lib/quantities.js` (m/s, m, s, °C, degrés).
4. Ajouter la fonction à `FACTORIES` dans `sources/index.js`.

### Meetnet : comment les paramètres sont reconnus

Le catalogue Meetnet (`/V2/catalog`) liste des couples station + paramètre. L'adaptateur reconnaît chaque paramètre à son nom anglais (vent moyen, rafales, direction, hauteur de vagues, période, températures…) et garde un seul paramètre par grandeur et par station. Pour vérifier le résultat une fois connecté : `GET /api/debug/meetnet`.

## À valider avec un vrai compte

Ce prototype a été écrit d'après la documentation de l'API V2 sans accès réel à l'API. À vérifier au premier lancement : le classement des paramètres (`/api/debug/meetnet`), les unités (les vagues peuvent être en cm, la conversion est prévue) et les coordonnées des stations.
