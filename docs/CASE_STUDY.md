# A friend dared me to build Pass the Pigs during the apéro. Two LLMs reviewed my plan.

*Or: a non-technical friend wanted to see what AI could do. He watched it plan — and watched two AIs shred the plan.*

## The challenge

It happened at an apéritif, in front of a non-technical friend who wanted to see what AI could do. We were playing le jeu de cochons (Pass the Pigs) — the apéro game where you throw two tiny pigs, they land in one of seven positions, and you push your luck against the scoreboard. He picked it up, turned to me, and dared: "go on — make an app out of it. Right now. Show me what AI can do."

The desktop wakes up. Challenge accepted. It looks trivial. It is not.

My concept was "one-line to code": give an LLM a short prompt, let it plan, let it build, ship it. A modern party trick.

Honesty clause #1: it wasn't literally one line. It took a few short exchanges — still almost no hand-holding from me, but I won't pretend it was a single prompt. The pigs are simple, right?

## The prompts (zero engineering)

The prompts were apéro-grade: casual, naive, written in French over drinks — no templates, no role-play framing, no few-shot examples, no chain-of-thought coaxing. Translated from the originals:

1. The spec ask: *"I'd like you to analyze this game — https://fr.wikipedia.org/wiki/Jeu_de_cochons — and think about how to turn it into a game. Don't code anything: just analyze the rules and define what would need to be done, in product-definition mode."* — the entire game description was one Wikipedia link; the model read the rules itself.
2. The plan ask: *"I like approach B, detail it, prepare an initial dev plan to get a playable game, bug-free, tested and robust, that reproduces the base game's experience as faithfully as possible… give me that plan so I can have it reviewed. If the review is bad, I'll have a bad image of deepseek pro."* — my entire incentive system, in one sentence.
3. The review ask: *"Do an adversarial review of this plan, with Codex as the lead and Claude as secondary, with 2 loops."*

That's the whole prompt-engineering budget: zero. No magic incantations — the quality came from the process: two independent models, a gate at every stage, disagreement as a signal. Anyone can type these three prompts.

## The catch

Pass the Pigs has a famously ambiguous rulebook, and the game is really about *probabilities* — when to bank, when to roll again. The scoring semantics (Bon Jambon, Cochon à Cheval, Pig Out, the "Somme" rules) are exactly where a happy few-lines plan goes to die.

So instead of trusting the plan those few prompts produced, I ran it through an adversarial review pipeline, orchestrated by Hermes Agent — the framework where these skills live. My Hermes runs on DeepSeek Flash for orchestration: the cheap part of the loop. The real work is done by the two specialist models — the plan was written by Codex as the architect, then reviewed independently by Claude Fable 5 as the inspector; a synthesis pass merged, categorized, and ranked their findings.

The cost story is deliberately mundane: the whole loop ran on basic consumer plans — a €20/month Claude subscription and a €20/month Codex subscription, each model's turn scheduled inside its quota window. No API credits, no enterprise accounts. The pipeline is designed to fit inside the limits a hobbyist already pays for.

Neither model is special, either: the pipeline accepts any LLM CLI on either side — Claude, Codex, Gemini, GLM, or fully local models served by llama.cpp (my Hermes already routes to local models). The only real requirement is two *different* model families: two copies of the same model share the same blind spots, and the whole point is a second opinion that isn't a copy of your first one.

## The numbers

| Reviewer | Findings |
|---|---|
| Codex alone (architect) | 7 |
| Claude Fable 5 alone (inspector) | 11 |
| **Both, merged** | **16 unique findings** |

- **3 findings were found independently by both models** — the highest-confidence class. All three are *major* bugs in the probability model.
- 6 more reached consensus after discussion; 4 were partial (agreement on the issue, disagreement on severity); 3 were genuinely disputed.

The duo found **+5 findings over the best single model** (16 vs 11), and — more important than the count — the two models *independently converged on exactly the three most dangerous bugs*.

## The timeline (one apéro)

Everything started at the apéritif and finished the next morning — the session log tells the story: dare at 21:12, plan and adversarial review that night, then a quota wall (one of the two subscriptions ran out mid-loop), and I went to bed while the pipeline kept running. A playable build was committed at 01:38; the real finish came in the morning, when the GitHub Pages URL needed one more fix at 10:32 (the classic Vite base-path 404) — so the first people to try the link that morning saw nothing. Five commits across an evening, a night, and a morning. The commit for the playable version reads, in part:

> Moteur de règles complet (push-your-luck, probabilités calibrées) … 73 tests (unitaires + calibration 1M tirages + Playwright E2E) — Build Vite ~16KB gzip. Développé via adversarial dev loop (Codex DEV + Claude Fable 5 REVIEW)

An apéritif game that fits in 16KB gzipped, tested 73 ways, calibrated against a million simulated rolls — and the project's own commit history credits the adversarial loop. The full review trail (647-line plan, both models' findings, synthesis) is committed right next to the code.

## The full chain (spec → plan → code)

The plan review was one gate in a chain. The session opened with a spec pass — the product-definition analysis of the game's rules (scoring table, the three possible approaches, the four traps of going digital) — and everything downstream ran on it. After the plan was corrected, the code itself went through the same two-model loop, phase by phase (that's what adversarial-code-loop is for). The last phase's review caught two real major bugs the test suite had missed — in fact, the tests were asserting the buggy behavior: player names were HTML-escaped at the wrong layer (a name like `A&B <Bob>` was stored and displayed as `A&amp;B &lt;Bob&gt;`), and the localStorage high-score loader trusted unvalidated names. Both fixed, the tests corrected, all 73 green.

Spec → plan → code: every stage is a gate where two independent models disagree in your place. That's the chaining the skills encode — adversarial-spec drafts the stage, adversarial-plan gates it, adversarial-code-loop keeps the code honest.

## The three findings both models caught

1. **The flank probabilities don't add up.** The plan assigned 12.25% to *each* of two flank outcomes — but the two outcomes together total 12.25%, not 24.5%. A player's whole luck-push strategy was built on a doubled probability.
2. **The override rule silently kills a result.** Sequential checks for Bon Jambon / Cochon à Cheval overrides change the effective distribution — Cochon à Cheval ends up at 0.78% unless modeled as a disjoint probability partition.
3. **The Jambon rule contradicts itself.** One section of the plan treats Bon Jambon as a turn-ending catastrophe; another treats it as a negative score clamped with `Math.max(0, score)`. The game's most exciting rule was unimplementable as specified.

A single model can flag these. A single model cannot *confirm* them. Two models converging on the same bug is the closest thing to a second opinion you can get from an LLM — and it cost nothing but one extra review pass.

Honesty clause #2: the review made the probabilities *internally consistent* — it did not make them *true*. The corrected values still come from the models' reasoning, not from rolling actual pigs. The tests do run a million-roll calibration, but those are *simulated* rolls: they stress-test the code, not the physics of real pigs. I am genuinely not sure the produced probabilities are right; they need calibration against real throwing data before I'd trust the strategy advice the game displays.

## The part nobody talks about: the disputes

The adversarial setup does something a solo review can't: it produces *disagreement*. Three findings ended up disputed — e.g., "can `nextPlayer()` loop forever if everyone is eliminated?" — where the reviewer called it a real bug and the architect showed it's unreachable under valid transitions.

That dispute signal is precious: it tells you exactly which parts of your plan are genuinely ambiguous and need a human decision, instead of silently shipping your assumptions.

## Honesty clause #3

More findings ≠ better, if they're noise. The 16 findings were categorized precisely because of that: 3 cross-validated, 6 consensus, 4 partial, 3 disputed. The 13 that survived discussion were real, and the plan (v1.1) was corrected around them — probability model reworked, scoring made explicit, state transitions centralized — **before a single line of game code was written**.

The apéritif game went from dare to playable build by the end of the night — built from a plan that two models shredded, argued about, and rebuilt. That's the "few prompts to code" I actually want: a couple of short exchanges in, a reviewed, correct plan out.

---

*Tools: [adversarial-code-loop](https://github.com/chpomob/adversarial-code-loop) (build → review → fix pipeline, model-agnostic, one-line installer), [adversarial-plan](https://github.com/chpomob/adversarial-plan), [adversarial-spec](https://github.com/chpomob/adversarial-spec) — all orchestrated by [Hermes Agent](https://github.com/NousResearch/hermes-agent). The game — [play it](https://chpomob.github.io/jeu-de-cochons/), [read the code](https://github.com/chpomob/jeu-de-cochons) — plan v1.1 after review, full review artifacts in `review/`.*
