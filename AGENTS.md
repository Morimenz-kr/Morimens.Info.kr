# AGENTS.md

## Response language

Write every user-facing response in **Korean**.

## UI work

Before implementing, modifying, reviewing, or debugging any user interface, read `docs/responsive-design.md` completely and follow it.

UI work is not complete until its responsive behavior has been verified as required by that document.

## D-Zone data and tooltips

Before changing D-Zone effects, read `docs/dzone-content-pipeline.md` and the tooltip-writing rules in `docs/game-keywords.md`.
Regenerate semantic descriptions from actual Skill/State/Cmd references; do not patch generated JSON or match effects by Korean names alone. Inspect generation diagnostics and warnings, preserve verified stage statistics, and run the content regression tests.
