# Code Review — Jeu des Cochons Plan

## Executive Summary
Overall structure is promising, but the probability model and rule semantics need rework before implementation.
Highest-risk themes: flank probability double counting, override probability ambiguity, Jambon scoring contradiction, and underspecified scoring/state transitions.
Findings: 3 cross-validated, 6 consensus, 5 partial, 3 disputed.
No blockers were reported, but several major issues affect correctness and implementability.
Fix the probability/rules model first, then harden state/action flow.

## Cross-Validated Findings (high confidence)

### MAJOR
| ID | Severity | File | Description |
|----|----------|------|-------------|
| A1/B1 | major | `/tmp/jeu-cochons-plan.md:73` / `:137` | Flank probabilities are mathematically inconsistent: two flank outcomes total 12.25%, but the plan assigns 12.25% each to Bon Flanc and Cochon Nul. |
| A2/B5/DA2-1 | major | `/tmp/jeu-cochons-plan.md:83` / `:145` | Override handling for Bon Jambon and Cochon à Cheval changes the effective distribution; sequential checks make Cheval effectively 0.78% unless modeled as a disjoint probability partition. |
| A5/B4 | major | `/tmp/jeu-cochons-plan.md:209` / `:359` | Bon Jambon semantics conflict: one section treats it as a turn-ending catastrophe, another as a negative score clamped with `Math.max(0, score)`. |

## Consensus Findings

| ID | Severity | File | Description |
|----|----------|------|-------------|
| B2/DA2-2 | major | `/tmp/jeu-cochons-plan.md:138` / `:151` | The `Somme` probability and catastrophe rate are derived from the wrong flank and override model; expected value and strategy guidance are unreliable. |
| B3 | major | `/tmp/jeu-cochons-plan.md:130` | Individual landing point values are missing, so `computeScore()` and “Somme” scoring are not implementable unambiguously. |
| B9 | minor | `/tmp/jeu-cochons-plan.md:235` | 1000 rolls are insufficient for probability calibration; tests need deterministic invariant checks plus high-volume seeded statistical checks. |
| B10 | nit | `/tmp/jeu-cochons-plan.md:187` | `flankSide` is meaningful only for `FLANC`; returning it for other landings risks bad downstream classification. |
| B11 | nit | `/tmp/jeu-cochons-plan.md:33` | `canRoll` duplicates phase-derived state and can drift from `TURN_OVER` / `DECIDING`. |
| A6 | major | `/tmp/jeu-cochons-plan.md:13` | `localStorage` player/high-score data needs a trust boundary: schema validation, length caps, safe rendering, and CSP guidance. |

## Partial Findings

| ID | Severity | File | Description |
|----|----------|------|-------------|
| A3/B8 | major/minor | `/tmp/jeu-cochons-plan.md:112` / `:36` | There is agreement that state naming/transition authority needs clarification, but disagreement on whether the enum/state-machine mismatch is inherently a bug. |
| A4 | major | `/tmp/jeu-cochons-plan.md:187` | Animation/input flow lacks explicit serialization, roll tokens, or stale-callback guards. Not independently reviewed, but aligns with broader state-transition concerns. |
| A7 | minor | `/tmp/jeu-cochons-plan.md:31` | Engine purity is claimed but mutation semantics are not defined. Related to state consistency concerns, but not directly validated. |
| B7 | minor | `/tmp/jeu-cochons-plan.md:360` | Elimination should explicitly discard `turnScore`; reviewer agreed this clarification is useful, but challenged the broader ≥100-score concern as likely unreachable. |

## Disputed Findings

| ID | Positions |
|----|-----------|
| B6 | **Inspector**: `nextPlayer()` can loop forever if all players are eliminated and no non-eliminated player exists. **Architect**: this is not reachable under valid transitions because victory/game-over should be checked after eliminations; bounded iteration is useful defensively but not a demonstrated plan bug. |
| B7 | **Inspector**: Cochon à Cheval elimination leaves `turnScore` and winner/eliminated interactions underspecified. **Architect**: no banking is strongly implied by the direct transition to `NEXT_PLAYER`; only explicit documentation is needed. |
| B8 | **Inspector**: phase enums and state-machine labels are inconsistent. **Architect**: labels may be transient actions/transition labels rather than persisted enum states; clarification is needed, but not necessarily a model flaw. |

## Summary Statistics
- Cross-validated: 3
- Consensus: 6
- Partial: 4
- Disputed: 3
- Total unique findings: 16

## Recommendations
1. Fix the canonical probability model first: flank side distribution, override ordering, final resolved distribution, and derived strategy metrics.
2. Define scoring as explicit outcome effects, especially for Bon Jambon, Cochon Nul, and Cochon à Cheval.
3. Add missing point constants for individual pig positions and generate probability/scoring tables from config or tests.
4. Centralize state transitions in a reducer/controller with legal-action guards and animation/input tokens.
5. Review disputed items with a human, but still add cheap defensive guards where they reduce implementation risk.