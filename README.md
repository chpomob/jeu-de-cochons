# Jeu de Cochons

**[Jouer en ligne →](https://chpomob.github.io/jeu-de-cochons/)**

Jeu web inspiré de *Pass the Pigs*: lancez deux cochons, marquez des points selon leurs positions et soyez le premier à atteindre 100 points.

## Règles du jeu

À votre tour, vous pouvez lancer les cochons plusieurs fois pour accumuler des points temporaires, puis les sécuriser en passant la main. Certaines combinaisons rapportent beaucoup, mais un mauvais lancer peut annuler le tour ou faire perdre des points selon le cas.

Le premier joueur qui atteint 100 points gagne la partie.

## Comment jouer

1. Choisissez le nombre de joueurs et leurs noms.
2. Lancez les cochons pendant votre tour.
3. Continuez pour tenter de marquer davantage ou passez pour ajouter le score du tour à votre total.
4. Surveillez les positions spéciales: elles peuvent fortement changer le résultat du tour.

## Stack technique

- Vite
- JavaScript modules
- CSS natif
- Vitest et jsdom pour les tests unitaires
- Playwright pour les tests end-to-end
- PWA avec manifest, icônes PNG et service worker

## Développement

```sh
npm install
npm run dev
```

## Build production

```sh
npm run build
```

Le build génère les icônes PWA puis publie l'application statique dans `dist/`.

## Déploiement Netlify

Le fichier `netlify.toml` configure la commande de build et le dossier de publication:

```sh
npm run build
```

Publication: `dist/`.

## Crédits

Jeu original créé par David Moffat en 1984.
