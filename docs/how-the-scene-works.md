# How the lanterns.dev scene works — in plain terms

*A non-technical explainer for talking about the site with anyone. No background needed.*

Open [lanterns.dev](https://lanterns.dev) and you see a single image: a lantern on
a wooden dock at dusk, a calm lake, a fading sunset. Look a little longer and it's
quietly **alive** — the flame flickers, the water ripples and catches light, a few
small lights wink on across the far shore, and the distant treeline stirs in the
breeze. It looks like an oil painting in a realism style, but it's breathing.

This note explains what's actually happening, and — more generally — what the
technology behind it (a *shader*) is.

---

## The 30-second version

There is **no video and no animation file** on the page. There's one still photo
and a small program. Everything that moves is being *calculated*, live, on your
device — like a flip-book that draws its own next page, sixty times a second,
instead of playing back a recording.

That small program is called a **shader**.

## What's a shader, really?

Your screen is a grid of millions of tiny dots (pixels). A shader is a program with
one job: for **every single dot, sixty times a second, decide what color it should
be right now.**

Think of it as an impossibly fast, impossibly precise painter. Sixty times a second
this painter repaints the entire picture from scratch — and for every fleck of
paint, it knows exactly how bright and what color that fleck should be, given an
imagined flame, a breeze, and a sinking sun. Because it re-decides constantly, the
picture can move and shimmer. But it never stores a "movie" — it works out the next
moment fresh, every time, from a handful of rules about how light behaves.

Shaders are what draw nearly every modern video game and 3D film. We're using the
same idea for something small and calm: one quiet scene, done well.

## The one idea that makes it feel real: everything shares one wind

The lazy way to animate a scene is to make each thing wobble on its own timer. It
always looks fake — because in a real place, everything responds to the *same*
conditions at the *same* time.

So our scene has **one imagined breeze.** When a gust rolls through, that single
gust flickers the flame, stirs the water, *and* sways the far trees — together, in
the same instant. Your eye can't name why, but it reads that shared cause as "this
is one real place," not a pile of separate tricks.

*(We learned this the hard way. An early version flickered the flame but left the
light it cast perfectly still — and it felt flat and wrong. Coupling everything to
one breeze was the fix.)*

## The hard part: water

Water is famously difficult to fake, and it's where most of the craft went.

Our first attempts drew ripples as little moving lines. It read as "lines on a
screen," not water. The breakthrough came from how real water actually works: **you
don't really see the ripples — you see light glinting off the crests of the waves.**
And those glints aren't scattered evenly; they gather into a bright, sparkling path
that points toward the light (here, the sunset), and fade away in the darker water.

So instead of drawing ripples, we simulate the wave surface and let light *sparkle*
off it — small, sharp, scattered glints, concentrated where the sunset reflects,
exactly the way a calm lake looks at dusk. The wave math itself is borrowed from how
video games render oceans. This was the one place we did formal research, and the
one deliberately complex thing on the entire site.

## The small touches that sell it

- **Telling the computer what's what — a coloring book.** A shader sees the photo as
  a flat grid of colors; it has no idea which parts are water, dock, or flame. So we
  hand-painted a simple overlay — like a coloring book — marking the water, the dock
  planks the lamplight falls on, and the flame itself. That's how the ripples only
  touch the water, and the warm glow only lands on the wood.
- **Lights across the shore.** A few tiny lights on the far shore switch on at
  different moments while you sit with the page — so the scene keeps gently revealing
  itself over the first minute, rather than showing everything at once.
- **It never breaks.** On an older phone, in battery-saver mode, or in a browser
  that can't run the effect, the site quietly shows a *still* version of the same
  scene. No error, no blank page — just a calmer picture. Nobody ever gets a broken
  experience.

## Why we built it this way: one thing, done right

The site has exactly one idea and commits to it completely. The type is plain, the
layout is deliberately boring, there's almost no text. **Every ounce of craft went
into making one scene feel alive** — and, just as importantly, feel *calm*. The
failure mode for an effect like this is looking flashy or fake; restraint is what
keeps it feeling real.

That's the whole philosophy: when everything else is quiet, the one moving thing has
room to be beautiful — and room to be *right*, not just impressive.

---

## A tiny glossary (for the curious)

- **Shader** — a program that runs on your device's graphics chip and decides the
  color of every pixel, many times a second. The engine behind the whole scene.
- **Pixel** — one of the millions of tiny dots that make up your screen.
- **Render** — to draw a frame. Our scene renders ~60 frames every second.
- **Fallback** — the simpler version shown when the full effect can't run (old
  device, low-power mode, etc.). Here, a still image of the same scene.
