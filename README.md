# lanterns.dev

The [Lanterns](https://lanterns.dev) site. One scene: a lantern on a dock at
dusk, with a few pages over it. Essays live on
[essays.lanterns.dev](https://essays.lanterns.dev) (Ghost). Static files, no
build step; the one dependency is EmailJS's SDK, vendored, for the contact form.

## Preview

There is no hosted preview: GitHub Pages builds from `main`, so a branch is only visible locally.
Check out the branch, serve the folder, and open it:

```
python3 -m http.server 8000 --directory ~/GitHub/Lanterns/lanterns.dev
```

Then `http://localhost:8000`. Hard-reload (Cmd+Shift+R) after each edit — the browser caches the
scripts. Judge on desktop **and** portrait mobile; for widths, use a same-origin iframe rather
than resizing the window (Chrome's device inspector can't be driven by an agent, and a window
can't exceed the physical screen).

Code is MIT-licensed. **Brand assets (all images in `assets/`) are
© 2026 lanterns, all rights reserved** — see `assets/LICENSE.md`.
