# DOBI — Front (React + Vite + Tailwind)

```bash
npm install
copy .env.example .env      # puis vérifier VITE_API_URL (API Laravel, ex. http://127.0.0.1:8001/api/v1)
npm run dev                 # http://localhost:5173
```

L'API doit tourner (`php artisan serve --port=8001`) et `FRONTEND_URL` du `.env` Laravel doit contenir `http://localhost:5173`.

## Vercel
Importer le dossier `dobi-front`, variable d'environnement `VITE_API_URL` = adresse de l'API en HTTPS.
Ajouter l'URL Vercel dans `FRONTEND_URL` côté Laravel (séparée par une virgule).

## Écrans
/login, /register, /forgot-password, /reset-password · / (mes études, création) · /studies/:id (questionnaire, publication, lien + QR, résultats, export CSV) · /s/:slug (réponse publique, classique ou une question à la fois) · /o/:slug (page publique d'une organisation).

## Pas encore inclus
Gestion des membres, modification d'une question existante, réorganisation par glisser-déposer, réglages d'une étude après création, statistiques par jour.
