# GitHub Repo Setup — Copy These Exactly

## Repo Name
hudson-perry-drift-law

## Description (one line, goes in the About field)
Real-time mathematical control layer for AI conversation coherence. SDE + Kalman + GARCH + TF-IDF/JSD running client-side. 17 modeling components. MIT licensed.

## Topics (paste these into the Topics field on GitHub)
kalman-filter
sde
stochastic-differential-equations
garch
jsd
jensen-shannon-divergence
llm
ai-safety
coherence
drift-detection
hallucination-detection
anthropic
claude
typescript
react
edge-ai
real-time
research

## Website field
Leave blank for now (add when you have a GitHub Pages site or hosted demo)

## Checkboxes to enable
[x] Issues
[x] Discussions  ← important, lets researchers share session data
[ ] Projects (not needed yet)
[x] Wikis (optional, for extended documentation)

## First pinned issue to create (copy this as Issue #1)

Title: Open: C-score vs human judgment validation data

Body:
The most valuable contribution to this research right now is empirical validation data.

If you run sessions with ARCHITECT and use the human override scoring (MY: field per turn), you can export your ratings alongside the raw C scores using the "EXPORT WITH MY RATINGS" button in the SUMMARY card.

Share your anonymized session data here. Include:
- Your domain/use case (TECHNICAL, CREATIVE, RESEARCH, etc.)
- Session length (number of turns)
- Correlation coefficient r from the export
- Any notes on where the C score felt wrong vs right

This directly addresses the open validation item: C-score correlation with human judgment.

Labels: research, validation, help wanted
