DOBI — Mise à jour frontend : constructeur et formulaire par étapes

Fichiers à remplacer dans le projet dobi-front :
- src/pages/Study.jsx
- src/pages/Public.jsx

Cette mise à jour suppose que le patch backend « dobi-backend-etapes » de Claude est appliqué, notamment :
- GET /studies/{study}/questionnaire retourne sections avec title, description, position et rules ;
- PUT /studies/{study}/layout existe ;
- POST /studies/{study}/reorder accepte sections ;
- PUT /sections/{section} accepte description et rules ;
- le questionnaire public versionné retourne questionnaire.sections et questionnaire.questions.

Après remplacement, dans le dossier dobi-front :
  npm install
  npm run build

Puis tester en local avant déploiement Vercel.

Fonctionnalités frontend ajoutées :
- création/modification/suppression des étapes avec description facultative ;
- questions regroupées par étape ;
- ajout de questions dans l'étape sélectionnée ;
- déplacement de questions entre étapes ;
- réorganisation des étapes ;
- conditions d'affichage des étapes et des questions ;
- types de questions compatibles avec les types exposés par le patch backend ;
- aperçu interactif par étape ;
- formulaire public avec navigation étape précédente/suivante, barre de progression et validation locale des champs obligatoires ;
- prise en charge du GPS sous forme lat/lng.

Important : ne déployer le frontend qu'après avoir appliqué et testé le patch backend correspondant.
