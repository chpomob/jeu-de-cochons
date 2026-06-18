# Plan de développement — Jeu de Cochons (Pass the Pigs)
## Approche B : Animation précalculée — Fidèle, légère, robuste

> **Version 1.1** — corrigée après adversarial review Codex (Architect) × Fable 5 (Inspector)
> 16 findings traités — probabilités recalibrées, effets explicites, reducer centralisé, trust boundary localStorage

---

## 0. Vision et contraintes fondatrices

**Objectif :** reproduire l'expérience du jeu de base (2 à N joueurs, 100 points, figures exactes) avec la fidélité maximale à l'esprit du jeu physique, sans moteur 3D.

**Contrainte de conception :** le résultat du lancé est DÉTERMINÉ AVANT l'animation. L'animation est un habillage scripté qui converge vers le résultat pré-tiré. Ceci garantit :
- Zéro bug de « l'animation ne correspond pas au score »
- Probabilités calibrées mathématiquement
- Pas de divergence serveur/client si mode online plus tard

**Pile technique :** SPA web (HTML5 Canvas + Vanilla JS ou Preact), zéro backend, localStorage pour les high-scores. PWA pour installation mobile.

### Contrainte sécurité (review A6)

localStorage est une surface d'attaque. Toute donnée qui y est stockée (noms de joueurs, high-scores, préférences) doit être :
1. Validée contre un schéma strict au chargement (rejeter toute entrée non conforme, réinitialiser au défaut)
2. Noms de joueurs limités à 30 caractères, sanitizés (pas de HTML)
3. Rendu via `textContent` ou échappement framework — jamais `innerHTML`
4. CSP déployé avec `script-src 'self'` (pas de `'unsafe-inline'`)

---

## 1. Architecture de la logique métier (cœur du jeu)

Le cœur du jeu est pur, sans UI, sans animation. Il vit dans un module `engine.js` testable unitairement à 100%.

### 1.1 Structures de données

```
Player {
  id: string
  name: string
  totalScore: number       // points sécurisés (bankés)
  isEliminated: bool
}

TurnState {
  playerId: string
  turnScore: number        // points accumulés depuis le début du tour
  currentRoll: RollResult | null
  phase: 'ROLLING' | 'DECIDING' | 'TURN_OVER'
  // canRoll supprimé (review B11) — redondant avec phase
  // phase === 'DECIDING' ⇒ le joueur peut relancer ou banker
  // phase === 'TURN_OVER' ⇒ tour terminé, passage au suivant
}

GameState {
  players: Player[]
  currentPlayerIndex: number
  turn: TurnState
  winner: string | null
  rollHistory: RollHistoryEntry[]
  rollId: number           // incrémenté à chaque nouveau lancé (review A4)
  turnId: number           // incrémenté à chaque nouveau tour (review A4)
  phase: 'SETUP' | 'PLAYING' | 'GAME_OVER'
}
```

### 1.2 Types énumérés exhaustifs

```
// Positions d'un cochon seul
SinglePigLanding = 'FLANC' | 'TROTTEUR' | 'TOURNEDOS' | 'GROIN_GROIN' | 'BAJOUE'

// Côté du flanc (défini UNIQUEMENT si landing === 'FLANC', null sinon — review B10)
FlankSide = 'DROIT' | 'GAUCHE'

// Type de résultat d'un lancé
RollResultType = 'SOMME' | 'BON_FLANC' | 'DOUBLE_TROTTEUR' | 'DOUBLE_TOURNEDOS'
               | 'DOUBLE_GROIN_GROIN' | 'DOUBLE_BAJOUE'
               | 'COCHON_NUL' | 'BON_JAMBON' | 'COCHON_A_CHEVAL'

// Effet du lancé (review A5/B4/B7 — remplace les scores ambigus pour les catastrophes)
RollEffect = 'GAIN_POINTS' | 'PERTE_TOUR' | 'PERTE_TOTALE' | 'ELIMINATION'

RollResult {
  type: RollResultType
  effect: RollEffect
  points: number           // 0 si l'effet n'est pas GAIN_POINTS
  pig1: {landing: SinglePigLanding, flankSide: FlankSide | null}
  pig2: {landing: SinglePigLanding, flankSide: FlankSide | null}
}
```

### 1.3 Machine d'états

Le diagramme ci-dessous distingue les **états persistants** (en MAJUSCULES, correspondent aux enums) des **transitions transitoires** (flèches). Revue B8 : les labels comme PLAYER_TURN_START, CHECK_VICTORY, NEXT_PLAYER sont des transitions, pas des états stockés.

```
SETUP ──→ PLAYING ──→ GAME_OVER
              │
              └─→ [début tour] phase=ROLLING (turnScore=0)
                        │
                        ├─→ [joueur lance] → phase=ROLLING → animation → résultat
                        │       │
                        │       ├─→ effet=PERTE_TOUR (Cochon Nul)
                        │       │       → phase=TURN_OVER → joueur suivant
                        │       │
                        │       ├─→ effet=PERTE_TOTALE (Bon Jambon)
                        │       │       → totalScore=0, phase=TURN_OVER → joueur suivant
                        │       │
                        │       ├─→ effet=ELIMINATION (Cochon à Cheval)
                        │       │       → isEliminated=true, turnScore défaussé
                        │       │       → phase=TURN_OVER → joueur suivant
                        │       │       → si 1 seul survivant → GAME_OVER
                        │       │
                        │       └─→ effet=GAIN_POINTS
                        │               → turnScore += points
                        │               → phase=DECIDING
                        │               │
                        │               ├─→ BANK → totalScore += turnScore
                        │               │       → si totalScore ≥ 100 → GAME_OVER
                        │               │       → sinon → joueur suivant
                        │               │
                        │               └─→ ROLL_AGAIN → phase=ROLLING → [boucle]
                        │
                        └─→ [joueur suivant] = premier joueur non éliminé après currentPlayerIndex
                                  → si aucun → GAME_OVER (tous sauf 1 éliminés)
```

### 1.4 Reducer centralisé (review A3)

Toute transition d'état passe par UNE fonction unique :

```
dispatch(gameState: GameState, action: Action): GameState | Error

Actions possibles :
  ROLL_REQUESTED     → vérifie phase=ROLLING, génère RollResult, émet ANIMATION_START
  ANIMATION_COMPLETED(rollId) → ignore si rollId ≠ gameState.rollId (review A4)
  BANK_REQUESTED     → vérifie phase=DECIDING, ajoute turnScore → totalScore
  SKIP_ANIMATION(rollId) → comme ANIMATION_COMPLETED mais sans attendre l'anim
```

Le `dispatch()` est le SEUL point d'entrée de mutation. L'UI et l'animation ne modifient jamais le state directement. Le state est immuable : chaque dispatch retourne un **nouvel objet** GameState (structural copy). En test, `Object.freeze()` sur l'ancien state garantit l'absence de mutation (review A7).

### 1.5 Fonctions du moteur

Toutes sont pures (pas d'effet de bord) et retournent un nouveau state ou des données. Le dispatch orchestre leur appel.

| Fonction | Rôle |
|---|---|
| `rollSinglePig(rng)` | Retourne `{landing, flankSide}` — flankSide = null si landing ≠ FLANC |
| `rollTwoPigs(rng)` | Retourne `{pig1, pig2}` via deux appels à rollSinglePig |
| `evaluateRoll(pig1, pig2, rng)` | Détermine le type de résultat (somme / spécial / bust avec overrides) |
| `computeResult(rollType, pig1, pig2)` | Retourne `RollResult` complet : type, effect, points |
| `applyRollResult(state, result)` | Transition d'état après un lancé (appelé par dispatch) |
| `bankTurn(state)` | Sécurise turnScore → totalScore (appelé par dispatch) |
| `startNextTurn(state)` | Trouve le prochain joueur non éliminé, initialise son tour |
| `checkGameOver(state)` | Vérifie ≥100 OU 1 seul survivant. Retourne le gagnant ou null |
| `createGame(playerNames)` | Constructeur de GameState |

### 1.6 Système de tokens rollId / turnId (review A4)

- `gameState.rollId` est incrémenté à chaque ROLL_REQUESTED
- Le résultat du roll et l'animation portent ce rollId
- Quand `ANIMATION_COMPLETED(rollId)` ou `SKIP_ANIMATION(rollId)` arrive, le dispatch IGNORE l'action si le rollId ne correspond pas au rollId courant
- `gameState.turnId` est incrémenté à chaque nouveau tour

Ceci empêche toute callback d'animation stale d'altérer l'état.

---

## 2. Modèle de probabilités (corrigé — review A1/B1/B2/B5)

### 2.1 Probabilités d'un cochon seul

Calcul par roulette wheel à partir des poids ci-dessous. La distribution est reproductible via le RNG seedable.

| Position | Poids | Probabilité | Points |
|---|---|---|---|
| Flanc | 35 | 35.00% | 0 |
| Trotteur | 22 | 22.00% | 5 |
| Tournedos | 22 | 22.00% | 5 |
| Groin groin | 13 | 13.00% | 10 |
| Bajoue | 8 | 8.00% | 15 |

Lorsque `landing === 'FLANC'`, le côté est tiré aléatoirement : DROIT 50%, GAUCHE 50%.
Pour toute autre position, `flankSide = null`.

### 2.2 Probabilités des combinaisons (issues de deux cochons indépendants)

Chaque probabilité ci-dessous est P(cochon1 = A ET cochon2 = B). Le total fait 100%.

| Combinaison | Calcul | Probabilité | Points | Effet |
|---|---|---|---|---|
| Bon Flanc (même côté) | 0.35² × 0.50 | 6.125% | 1 | GAIN_POINTS |
| Cochon Nul (côtés opposés) | 0.35² × 0.50 | 6.125% | 0 | PERTE_TOUR |
| Double Trotteur | 0.22² | 4.84% | 20 | GAIN_POINTS |
| Double Tournedos | 0.22² | 4.84% | 20 | GAIN_POINTS |
| Double Groin Groin | 0.13² | 1.69% | 40 | GAIN_POINTS |
| Double Bajoue | 0.08² | 0.64% | 60 | GAIN_POINTS |
| **Somme** (toute autre) | 1 − Σ ci-dessus | **75.74%** | p1+p2 (2–30) | GAIN_POINTS |

**Vérification :** 6.125 + 6.125 + 4.84 + 4.84 + 1.69 + 0.64 + 75.74 = 100.00% ✓

### 2.3 Overrides (Bon Jambon, Cochon à Cheval)

Dans le jeu physique, ces événements ne dépendent pas des positions mais de la proximité spatiale des cochons. On les modélise comme des overrides POST-tirage des positions.

**Pipeline de résolution (dans `evaluateRoll`) :**
```
1. Tirer pig1.landing, pig2.landing (section 2.1)
2. Déterminer la combinaison (section 2.2)
3. Tirage Bon Jambon (2.50%) → si oui, override : effet = PERTE_TOTALE
4. Si non, tirage Cochon à Cheval (0.80%) → si oui, override : effet = ELIMINATION
5. Sinon, conserver l'effet de l'étape 2
```

**Probabilités effectives après overrides :**
- P(Jambon) = 2.50%
- P(Cheval) = (1 − 0.025) × 0.008 = 0.78%
- P(pas d'override) = 1 − 0.025 − 0.0078 = 96.72%
- Chaque combinaison de la table 2.2 a sa probabilité multipliée par 0.9672 en pratique
- Cochon Nul effectif = 6.125% × 0.9672 ≈ 5.92%

### 2.4 Récapitulatif des probabilités finales

| Issue | Probabilité effective | Effet |
|---|---|---|
| Gain de points (toutes combinaisons sauf Nul/Jambon/Cheval) | ~87.88% | GAIN_POINTS |
| Cochon Nul | ~5.92% | PERTE_TOUR |
| Bon Jambon | 2.50% | PERTE_TOTALE |
| Cochon à Cheval | 0.78% | ELIMINATION |

Total = 87.88 + 5.92 + 2.50 + 0.78 = 100% (arrondi) ✓

### 2.5 Espérance mathématique (recalculée)

- Score moyen par lancé non-catastrophique : ~9.8 points
- Probabilité de perdre le tour (Nul) : ~5.92%
- Probabilité de perdre tous les points (Jambon) : 2.50%
- Probabilité d'élimination (Cheval) : 0.78%
- Optimal bank threshold (analyse risque/récompense) : **15–20 points**
- Durée moyenne d'une partie à 2 joueurs : **14–22 tours**

### 2.6 Fichier de configuration des probas

Toutes les probas, poids et constantes (seuil victoire = 100) sont externalisées dans `config.js`. Les tables de probabilités (2.2) sont **générées** à partir des poids unitaires (2.1) par un script de validation — pas maintenues à la main (review B5).

---

## 3. Système d'animation (Approche B détaillée)

### 3.1 Principe

```
ROLL_REQUESTED → tirage positions + overrides → RollResult (0 ms) → animation (1.2s) → ANIMATION_COMPLETED(rollId)
```

Le résultat est déterminé avant l'animation. L'animation n'est qu'un habillage. Le skip est purement visuel : `SKIP_ANIMATION(rollId)` déclenche immédiatement le dispatch avec le même résultat, sans attendre la fin de l'animation.

### 3.2 Sprites nécessaires

5 poses × 2 orientations (gauche/droite pour le flanc) = 10 sprites par cochon :
Flanc droit, Flanc gauche, Trotteur, Tournedos, Groin groin, Bajoue.
Format : PNG/SVG, ~200×200px. Style : dessin cartoon.

### 3.3 Séquences d'animation par lancé

Phase 1 : LANCER (0.0s → 0.3s) — propulsion vers le haut avec rotation
Phase 2 : RETOMBÉE (0.3s → 0.7s) — descente + 2-3 rebonds amortis
Phase 3 : STABILISATION (0.7s → 1.2s) — micro-oscillations puis pose figée
Phase 4 : RÉSULTAT (1.2s → 1.5s) — score/effet en fade-in

Durée totale : 1.2–1.5 secondes. Bouton "Skip" (ou Espace) toujours disponible.

### 3.4 Cas spéciaux d'animation

- **Bon Jambon :** cochons convergent vers positions adjacentes, animation de contact, flash rouge + texte « BON JAMBON ! Perte de tous les points ! »
- **Cochon à Cheval :** un cochon atterrit par-dessus l'autre, effet chevauchée, texte « COCHON À CHEVAL ! Joueur éliminé ! »
- **Cochon Nul :** flancs opposés avec "X" rouge, texte « Cochon nul ! Perte du tour »

### 3.5 Implémentation technique

Canvas 2D, double-buffer. Pas de librairie d'animation lourde. Architecture :

```
animation/
  sprites.js        → chargement et cache des sprites
  pigRenderer.js    → drawPig(ctx, pose, x, y, angle)
  sequences.js      → générateurs de keyframes (throw, land, jambon, cheval)
  tween.js          → interpolateur (ease, bounce, linear)
  animController.js → boucle rAF, skip, file d'attente, callbacks avec rollId
```

---

## 4. Interface utilisateur

### 4.1 Écrans

| Écran | Contenu |
|---|---|
| Menu principal | Titre, nombre de joueurs (2–6), saisie des noms, validation |
| Jeu (principal) | Barre de scores (joueur actif en surbrillance), zone Canvas animation, info « Tour : X pts », boutons Banker / Relancer, historique des lancés |
| Fin de partie | Gagnant affiché en grand, tableau récapitulatif des scores, bouton « Nouvelle partie » |

### 4.2 États de l'écran de jeu

```
┌──────────────────────────────────────────┐
│  J1: 45 ★ │  J2: 62 │  J3: 78 │  J4: 0  │
├──────────────────────────────────────────┤
│           🐷        🐷                   │
│          (animation)                     │
├──────────────────────────────────────────┤
│  Tour : 22 pts │ « Continue ou Bank ? »  │
│  [ BANKER ]  [ RELANCER ]                │
├──────────────────────────────────────────┤
│  Derniers lancés : 5 - 15 - 0 - 2 ...    │
└──────────────────────────────────────────┘
```

### 4.3 Comportement des boutons (revue A4)

- Les boutons Banker et Relancer envoient des **actions** au dispatch (BANK_REQUESTED, ROLL_REQUESTED), pas des mutations directes
- Les boutons sont désactivés quand `phase !== 'DECIDING'` OU quand une animation est en cours
- Anti double-clic : le bouton est désactivé immédiatement au clic (avant même l'appel dispatch)
- Premier lancé du tour : bouton affiche « Lancer » (turnScore === 0). Lancés suivants : « Relancer »

### 4.4 Accessibilité

- Support clavier : R = Relancer, B = Banker, Espace = Skip animation, Échap = Menu
- Écouteur global `keydown` sur `document` (pas dépendant du focus)
- Contraste WCAG AA minimum
- Messages textuels en complément de toutes les animations (redondance visuelle)
- Structure i18n prévue (français par défaut, clés de traduction externalisées)

### 4.5 Responsive design

- Desktop : layout horizontal, canvas 500×350px
- Tablette : layout adaptatif, canvas redimensionné
- Mobile (portrait/paysage) : canvas plein écran, boutons en bas
- Redimensionnement : canvas recalcule ses dimensions sans reset d'état

### 4.6 Transitions

- Menu → Jeu : fade 300ms
- Changement de tour : slide du nom du joueur actif + highlight barre de scores
- Fin de partie : overlay modal avec animation du gagnant

---

## 5. Plan de développement en 8 phases

### Phase 1 — Fondations (1j)

| # | Tâche | Vérification |
|---|---|---|
| 1.1 | Initialiser projet (Vite + structure dossiers) | `npm run dev` démarre |
| 1.2 | Configurer tests (Vitest + jsdom) | `npm run test` passe (test trivial) |
| 1.3 | Configurer linting (ESLint + Prettier, hook pre-commit) | `npm run lint` clean |
| 1.4 | Créer `config.js` — poids, constantes, textes, seuil victoire=100, CSP directives | Fichier valide, importé par le moteur |
| 1.5 | Module `types.js` — toutes les enums (SinglePigLanding, FlankSide, RollResultType, RollEffect, Action types) | Pas de magic strings ailleurs |

### Phase 2 — Moteur de règles (3j)

| # | Tâche | Tests associés |
|---|---|---|
| 2.1 | `rng.js` : générateur seedable (seed → déterministe, pas de seed → Math.random) | Reproduction bit-à-bit avec même seed |
| 2.2 | `rollSinglePig(rng)` : tirage pondéré → `{landing, flankSide \| null}` | Distribution sur 1M tirages (marge ±0.5%) |
| 2.3 | `rollTwoPigs(rng)` : deux appels indépendants à rollSinglePig | Indépendance statistique vérifiée |
| 2.4 | `evaluateRoll(pig1, pig2, rng)` : détermine combinaison → applique overrides Jambon/Cheval | Table de vérité complète (5×5 positions + overrides) |
| 2.5 | `computeResult(rollType, pig1, pig2)` → RollResult avec effet + points | Unitaire : chaque combinaison → résultat attendu |
| 2.6 | `createGame(playerNames)` : constructeur GameState valide | Objets conformes aux types |
| 2.7 | `dispatch(state, action)` : reducer unique (A3) — ROLL_REQUESTED, ANIMATION_COMPLETED, BANK_REQUESTED, SKIP_ANIMATION | Toutes les transitions légales + transitions illégales rejetées |
| 2.8 | `applyRollResult(state, result)`, `bankTurn(state)`, `startNextTurn(state)`, `checkGameOver(state)` — fonctions pures appelées par dispatch | Parties simulées complètes (1000 parties seedées) |
| 2.9 | Gardes défensives : `startNextTurn` limite l'itération à `players.length` + détecte 0 survivant → GAME_OVER (B6) | Test : tous éliminés sauf 1 → victoire automatique |

**Critère de fin :** 100% couverture de branchement. Test de calibration : 1 000 000 tirages seedés, distribution conforme aux probas effectives (section 2.4) avec tolérance statistique ±0.3% (review B9).

### Phase 3 — Moteur de rendu (4j)

| # | Tâche |
|---|---|
| 3.1 | Créer les 10 sprites (5 poses × 2 orientations). Format SVG ou PNG 200×200px |
| 3.2 | `spriteLoader.js` : préchargement asynchrone, cache, fallback |
| 3.3 | `pigRenderer.js` : `drawPig(ctx, sprite, x, y, angle, scale)` |
| 3.4 | `tween.js` : `linear`, `easeIn`, `easeOut`, `bounce` |
| 3.5 | `sequences.js` : keyframes pour throw, land (converge vers pose cible), jambon (contact), cheval (stacking) |
| 3.6 | `animController.js` : boucle rAF, skip, callback avec rollId. Émet `{rollId, completed}` |
| 3.7 | Résultat overlay : score/effet en fade-in. Variantes pour PERTE_TOUR, PERTE_TOTALE, ELIMINATION |

### Phase 4 — Interface utilisateur (3j)

| # | Tâche |
|---|---|
| 4.1 | Écran menu : nb joueurs (2-6), saisie noms (max 30 car., sanitization), validation |
| 4.2 | Écran jeu — layout : barre scores, canvas, zone info + boutons |
| 4.3 | Barre de scores : mise en évidence joueur actif, animation sur changement de score |
| 4.4 | Boutons Banker / Relancer : désactivés hors phase DECIDING, anti double-clic |
| 4.5 | Bouton « Lancer » (premier lancé, turnScore=0) / « Relancer » (turnScore>0) |
| 4.6 | Historique des lancés du tour : icône + points, défilement horizontal |
| 4.7 | Gestion clavier (R/B/Espace/Échap) — écouteur global |
| 4.8 | Responsive : desktop, tablette, mobile portrait + paysage |
| 4.9 | Écran de fin : gagnant, tableau scores, bouton « Rejouer » |
| 4.10 | Transitions : fade menu→jeu, slide tour, overlay fin |

### Phase 5 — Intégration (2j)

| # | Tâche |
|---|---|
| 5.1 | Controller : unique instance qui détient le GameState, expose `dispatch(action)`, notifie l'UI des changements |
| 5.2 | Blocage UI pendant animation : boutons + clavier ignorés, sauf Skip |
| 5.3 | Skip animation : envoie SKIP_ANIMATION(rollId) au dispatch → ignore si rollId stales |
| 5.4 | Gestion perte focus : l'animation continue (rAF se met en pause naturellement), état préservé |
| 5.5 | Chaîne asynchrone : promesses pour animation → dispatch → rendu UI |

**Critère de fin :** partie complète jouable de A à Z, 2 joueurs, hot-seat.

### Phase 6 — Sons et polish (2j)

| # | Tâche |
|---|---|
| 6.1 | Sons : lancé, score positif, cochon nul, bon jambon, cochon à cheval, victoire |
| 6.2 | Vibration mobile sur lancé (si supporté) |
| 6.3 | Animation transition tour : slide + highlight |
| 6.4 | Option muet dans le menu, sauvegardée dans localStorage (validée au chargement) |
| 6.5 | Schéma localStorage : validation stricte au chargement, reset si corrompu (review A6) |

### Phase 7 — Tests et débogage (3j)

| # | Tâche |
|---|---|
| 7.1 | Tests unitaires moteur : 100% couverture de branchement, état immuable vérifié (Object.freeze) |
| 7.2 | **Test de calibration probas** : 1 000 000 tirages seedés, toutes les issues comparées aux probas effectives, tolérance ±0.3% (review B9) |
| 7.3 | Tests d'intégration UI (Playwright) : parties complètes simulées, score final cohérent |
| 7.4 | Tests de performance : 100 000 lancés en < 1s (moteur pur). Animation à 60fps sur mobile bas de gamme |
| 7.5 | Tests multi-navigateurs : Chrome, Firefox, Safari, Edge |
| 7.6 | Tests de robustesse UI : spam clic Banker/Relancer, resize, perte focus, multi-touch, skip frénétique |
| 7.7 | Tests de sécurité localStorage : injection de données corrompues → reset propre, pas de crash, pas de XSS |
| 7.8 | Playtest humain : minimum 3 sessions avec 3–4 joueurs. Noter durée ressentie, frictions, confusions |
| 7.9 | Ajustement des probas : si la durée de partie n'est pas satisfaisante, modifier les poids dans `config.js` et relancer le test de calibration |

### Phase 8 — Déploiement (1j)

| # | Tâche |
|---|---|
| 8.1 | Build production : `npm run build` → bundle optimisé (minifié, tree-shaken) |
| 8.2 | PWA : service worker, manifest, icônes (192×192, 512×512), CSP `script-src 'self'` |
| 8.3 | Déploiement : Netlify / Vercel / GitHub Pages |
| 8.4 | README : règles du jeu, captures d'écran, crédits, lien vers le dépôt |

---

## 6. Cas limites et pièges — catalogue exhaustif

### 6.1 Pièges logiques

| Piège | Solution |
|---|---|
| Élimination vs victoire : un joueur à 95 points éliminé par Cheval | L'élimination prévaut — turnScore défaussé, joueur marqué isEliminated. La victoire ne se déclenche QUE sur un BANK (review B7) |
| Dernier joueur éliminé = fin de partie | `checkGameOver()` vérifie le nombre de survivants après chaque élimination. Si ≤ 1, GAME_OVER immédiat |
| Victoire ≥ 100 (pas « exactement 100 ») | Condition `≥ 100` après BANK uniquement |
| Perte totale (Jambon) : totalScore = 0 | Pas de score négatif. `totalScore = 0` explicitement |
| nextPlayer boucle infinie (B6) | Itération bornée à `players.length`. Si aucun survivant → GAME_OVER |
| Ordre Jambon vs Cheval | Jambon testé d'abord, Cheval ensuite (ordre de résolution documenté) |

### 6.2 Pièges UI/UX

| Piège | Solution |
|---|---|
| Double-clic Banker | Bouton désactivé avant l'appel dispatch. Le dispatch vérifie aussi la phase |
| Animation interrompue par skip | SKIP_ANIMATION(rollId) → dispatch vérifie rollId, applique le résultat déjà calculé |
| Callback d'animation stale | ANIMATION_COMPLETED(rollId) ignoré si rollId ≠ gameState.rollId (review A4) |
| Lancer vs Relancer | Même action ROLL_REQUESTED. Libellé du bouton dépend de `turnScore === 0` |
| Perte focus clavier | Écouteur global `keydown` sur `document` |
| Mobile : changement d'orientation | Canvas redimensionné, pas de reset d'état |
| Animations frustrantes | Skip permanent (Espace ou bouton). Vitesse réglable dans options (stockée localStorage) |

### 6.3 Pièges de tests

| Piège | Solution |
|---|---|
| Tests probabilistes flaky | RNG seedable obligatoire pour tous les tests. Mode test = `createRNG(42)`, mode prod = `createRNG()` |
| Canvas non testable en JSDOM | Mock du contexte 2D. Tests visuels via Playwright screenshots |
| Tests Playwright instables (timing) | Attendre sélecteurs CSS (`.phase-deciding`) plutôt que timeouts |
| localStorage corrompu entre tests | Nettoyage entre chaque test. Test d'injection : données malveillantes → reset propre |

---

## 7. Organisation du code

```
jeu-de-cochons/
├── index.html
├── package.json
├── vite.config.js
├── vitest.config.js
├── .eslintrc.js
├── public/
│   ├── manifest.json
│   └── icons/
│       ├── icon-192.png
│       └── icon-512.png
├── src/
│   ├── main.js                  ← point d'entrée, initialise le controller
│   ├── config.js                ← probas, constantes, textes, CSP
│   ├── types.js                 ← enums et types
│   ├── engine/
│   │   ├── game.js              ← createGame, createPlayer
│   │   ├── roll.js              ← rollSinglePig, rollTwoPigs
│   │   ├── evaluate.js          ← evaluateRoll, computeResult
│   │   ├── dispatch.js          ← reducer central : dispatch(state, action)
│   │   ├── actions.js           ← applyRollResult, bankTurn, startNextTurn
│   │   └── victory.js           ← checkGameOver
│   ├── animation/
│   │   ├── sprites.js           ← chargement et cache
│   │   ├── pigRenderer.js       ← drawPig(ctx, pose, x, y, angle)
│   │   ├── tween.js             ← easing functions
│   │   ├── sequences.js         ← générateurs de keyframes
│   │   └── controller.js        ← boucle rAF, skip, callbacks rollId
│   ├── ui/
│   │   ├── app.js               ← composant racine
│   │   ├── MenuScreen.js
│   │   ├── GameScreen.js
│   │   ├── ScoreBar.js
│   │   ├── RollHistory.js
│   │   ├── ResultOverlay.js
│   │   └── GameOverScreen.js
│   ├── audio/
│   │   └── sounds.js
│   └── utils/
│       ├── rng.js               ← générateur aléatoire seedable
│       ├── storage.js           ← localStorage avec validation schéma
│       └── sanitize.js          ← échappement HTML pour noms de joueurs
├── scripts/
│   └── validate-probas.js       ← génère et vérifie les tables de probas
└── tests/
    ├── engine/
    │   ├── roll.test.js
    │   ├── evaluate.test.js
    │   ├── dispatch.test.js
    │   ├── actions.test.js
    │   └── victory.test.js
    ├── calibration/
    │   └── probas.test.js       ← 1M tirages seedés (review B9)
    ├── integration/
    │   └── fullGame.test.js     ← parties complètes simulées
    ├── security/
    │   └── storage.test.js      ← injection localStorage, XSS (review A6)
    └── ui/
        └── gameplay.test.js     ← Playwright E2E
```

---

## 8. RNG seedable — clé de la testabilité

```javascript
const rng = createRNG(seed?)  // si seed absent → crypto.getRandomValues()
rng.random()                   // [0, 1) reproductible si seed
rng.weightedPick(items)        // tirage pondéré par items[].weight
```

En test : `createRNG(42)` → comportement déterministe.
En production : `createRNG()` → aléatoire cryptographique.

---

## 9. localStorage — validation schéma (review A6)

```javascript
const STORAGE_SCHEMA = {
  version: 1,
  highScores: [{name: 'string', score: 'number', date: 'string'}],  // max 20 entrées
  settings: {muted: 'boolean', animationSpeed: 'number'},           // 0.5–2.0
}

function loadState() {
  try {
    const raw = localStorage.getItem('jeu-cochons')
    if (!raw) return DEFAULT_STATE
    const parsed = JSON.parse(raw)
    if (!validateSchema(parsed, STORAGE_SCHEMA)) {
      localStorage.removeItem('jeu-cochons')  // corrompu → reset
      return DEFAULT_STATE
    }
    return parsed
  } catch { return DEFAULT_STATE }
}
```

Noms de joueurs : limités à 30 caractères, pas de `<>` ni `&`. Rendu via `textContent` ou `createTextNode()`.

---

## 10. Critères de succès par phase

| Phase | Critère de succès |
|---|---|
| P1 | `npm run dev`, `npm test`, `npm run lint` OK |
| P2 | 100% couverture branchement. 1M tirages calibrés dans la tolérance. |
| P3 | 20 lancés visuellement vérifiés. 60fps. Skip OK. |
| P4 | Navigation complète menu → jeu → fin → menu. Responsive. |
| P5 | Partie 2 joueurs complète sans bug. Controller unique, dispatch vérifié. |
| P6 | Sons + mute OK. Schéma localStorage validé. |
| P7 | 0 bugs connus. Test calibration 1M conforme. Tests injection localStorage OK. Playtest OK. |
| P8 | Build déployé, URL publique, PWA installable, CSP actif. |

---

## 11. Durée estimée

| Phase | Jours | Dépendance |
|---|---|---|
| P1 Fondations | 1j | — |
| P2 Moteur | 3j | P1 |
| P3 Animation | 4j | P2 |
| P4 UI | 3j | P3 |
| P5 Intégration | 2j | P2+P3+P4 |
| P6 Polish | 2j | P5 |
| P7 Tests | 3j | P5 (prérequis : P2) |
| P8 Déploiement | 1j | P7 |
| **Total** | **19j** | |

Marge 20% = **~23 jours-homme** pour un dev solo compétent.

---

## 12. Changelog v1.0 → v1.1

| Source | Correction |
|---|---|
| A1/B1 | **Probabilités flancs corrigées** : Bon Flanc 12.25% → 6.125%, Cochon Nul 12.25% → 6.125%, Somme 63.49% → 75.74% |
| B2 | Espérance et taux de catastrophe recalculés sur les probas corrigées |
| A2/B5 | Overrides documentés comme post-tirages avec probabilités effectives. Tables de probas générées depuis les poids, pas maintenues à la main |
| A5/B4 | **Effets explicites** : RollResult.effect ∈ {GAIN_POINTS, PERTE_TOUR, PERTE_TOTALE, ELIMINATION}. Ambiguïté Jambon/score négatif résolue → PERTE_TOTALE |
| B3 | **Valeurs de points par position** ajoutées dans la table 2.1 (Flanc=0, Trotteur=5, Tournedos=5, Groin=10, Bajoue=15) |
| A3 | **Reducer centralisé** : dispatch(state, action) comme seul point de mutation |
| A4 | **rollId/turnId** : tokens incrémentaux, callbacks d'animation vérifiés contre rollId courant |
| A6 | **localStorage trust boundary** : schéma, validation, sanitization, CSP |
| B6 | **Garde nextPlayer** : itération bornée, détection 0 survivant |
| B7 | **Élimination** : turnScore défaussé, élimination prioritaire sur victoire, documenté |
| B8 | **Diagramme d'états clarifié** : états persistants (MAJUSCULES) vs transitions (flèches) |
| B9 | **Test calibration** : 1 000 000 tirages seedés, tolérance ±0.3% |
| B10 | **flankSide = null** pour positions non-FLANC |
| B11 | **canRoll supprimé** de TurnState — redondant avec phase |
| A7 | **Immutabilité spécifiée** : state retourné par copie, Object.freeze en test |
