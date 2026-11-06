# DOBI — Interface (React)

Interface web de **DOBI**, plateforme pour créer, publier, collecter et analyser des questionnaires. Elle parle à l'API du dépôt `dobi-back`.

- Production : `https://dobi-sand.vercel.app` (Vercel)
- API : `https://dobi.alwaysdata.net`

## Technologies

React 18 · Vite · Tailwind CSS 4 · React Router · TanStack Query · Recharts (graphiques) · jsPDF (export PDF) · PWA (`vite-plugin-pwa`) · Vitest et Testing Library.

## Installation en local

```bash
git clone https://github.com/Osiax-dev/dobi-front.git
cd dobi-front
npm install
npm run dev
```

L'interface s'ouvre sur `http://localhost:5173`. Elle appelle par défaut l'API locale `http://127.0.0.1:8001/api/v1` : lance l'API (`php artisan serve --port=8001`) dans l'autre projet.

## Variable d'environnement

| Variable | Rôle |
|---|---|
| `VITE_API_URL` | adresse de l'API, avec `/api/v1` (par défaut `http://127.0.0.1:8001/api/v1`) |

Pour pointer vers un autre serveur, crée un fichier `.env.local` :

```
VITE_API_URL=https://dobi.alwaysdata.net/api/v1
```

Sur Vercel, définis la même variable dans **Settings, Environment Variables**. L'adresse du front doit aussi figurer dans `FRONTEND_URL` côté API.

## Commandes

```bash
npm run dev       # serveur de développement
npm test          # tests (Vitest)
npm run build     # build de production dans dist/
npm run preview   # voir le build en local
```

## Pages principales (`src/pages`)

| Fichier | Rôle |
|---|---|
| `Auth.jsx` | inscription, connexion, mot de passe oublié |
| `Dashboard.jsx`, `Organizations.jsx`, `Organization.jsx` | tableau de bord, organisations, membres |
| `Studies.jsx`, `Study.jsx` | liste des études, éditeur de questionnaire par étapes (glisser-déposer des questions) |
| `Public.jsx` | formulaire public de réponse |
| `Collecte.jsx`, `StudyCollectors.jsx`, `StudyParticipants.jsx` | collecte, enquêteurs, participants |
| `Results.jsx`, `ResultsHub.jsx` | résultats et statistiques |
| `Reports.jsx` | **rapports & synthèses** : aperçu, éditeur, historique, comparaisons, suggestions IA, exports |
| `Templates.jsx`, `Settings.jsx`, `Invitation.jsx` | modèles, paramètres du compte, invitations |

Fichiers utiles à la racine de `src` : `api.js` (appels à l'API), `auth.jsx`, `reportLayout.js` (mise en page des rapports), `reportPdf.js` (export PDF), `offline.js` et `pwa.jsx` (mode hors ligne), `ui.jsx` (composants communs).

## Tests

Les tests sont dans `src/__tests__`. Ils simulent l'API : aucune connexion réseau n'est nécessaire.
Les avertissements « width(0) » de Recharts pendant les tests sont normaux (pas de vraie mise en page dans l'environnement de test).

## Déploiement (Vercel)

Vercel construit le projet à chaque `git push` sur `main`. Le fichier `vercel.json` renvoie toutes les adresses vers `index.html` (nécessaire pour React Router). Avant de pousser :

```bash
npm test
npm run build
```

## Notes

- Les droits sont décidés par l'API ; l'interface se contente d'afficher ou de masquer les boutons.
- Les rapports sont réservés au propriétaire, à l'administrateur et à l'analyste de l'organisation.