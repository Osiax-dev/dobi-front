# DOBI (front)

Interface web de DOBI, une plateforme pour créer des questionnaires, collecter des réponses sur le terrain (même hors ligne) et les analyser.

Ce dépôt contient uniquement le front. L'API (Laravel) est dans un dépôt séparé.

- Application : https://dobi-sand.vercel.app
- Stack : React 18, Vite, Tailwind CSS, TanStack Query, application installable (PWA)

## Lancer en local

Prérequis : Node 22 et l'API DOBI qui tourne.

```bash
npm install
```

Créer un fichier `.env` à la racine :

```
VITE_API_URL=http://127.0.0.1:8001/api/v1
```

Puis :

```bash
npm run dev      # développement
npm test         # tests
npm run build    # version de production
```

## Déploiement

Vercel redéploie automatiquement à chaque push sur `main`. La variable `VITE_API_URL` est définie dans les réglages du projet Vercel.

## Auteur

Projet conçu et développé par **Osiax Tcheoubi**

GitHub : [Osiax-dev](https://github.com/Osiax-dev)

© 2026 Osiax Tcheoubi. Tous droits réservés (voir `LICENSE`).
