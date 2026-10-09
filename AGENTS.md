<!-- LOVABLE:BEGIN -->
> [!IMPORTANT]
> This project is connected to [Lovable](https://lovable.dev). Avoid rewriting
> published git history — force pushing, or rebasing/amending/squashing commits
> that are already pushed — as it rewrites history on Lovable's side and the
> user will likely lose their project history.
>
> Commits you push to the connected branch sync back to Lovable and show up in
> the editor, so keep the branch in a working state.
<!-- LOVABLE:END -->

- Theme colors live in semantic global CSS tokens; all role screens share the Frame header and Button controls so both themes stay consistent.
- Scanning access comes from the role alone — every agent holding the scanner code sees all live events — so the admin screens never re-add per-event scanner assignment (the old `event_scanners` checkboxes had no effect).
