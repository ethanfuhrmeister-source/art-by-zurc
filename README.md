# Zurc Catalog

An inventory of handmade pottery, published as a plain static site on GitHub Pages.
Live at <https://ethanfuhrmeister-source.github.io/art-by-zurc/>

It is a catalogue, not a shop: there is no checkout and no way to pay online.
Buyers see what exists, what it costs and what is already sold, then get in touch.

## What's here

| File | Purpose |
| --- | --- |
| `index.html` | The whole site — catalogue, piece viewer, print sheet and the studio. No build step, no dependencies. |
| `catalogue.json` | The inventory itself. Every piece, its item number, details and photo list. |
| `photos/` | The photographs. |

## The inventory

Each **piece** has its own record:

- an **item number** (`ZC-0001` by default, and editable to anything you like)
- a title, price, size and notes
- a **sold** flag
- **one or more photos** — the first is the one the catalogue shows

Sold pieces stay on the catalogue with a *Sold* mark rather than disappearing, and
the catalogue gains Everything / Available / Sold filters as soon as anything is sold.

Every piece has its own address: `…/#ZC-0001` opens that piece directly. That is
what the printed QR codes point at.

## Adding and editing pieces (the studio)

1. Open the site and **tap the name at the top five times** — or add `#studio` to the address.
2. First time on a device, paste a GitHub access token. It is stored in that browser
   only and never sent anywhere except GitHub. To make one: GitHub → Settings →
   Developer settings → Personal access tokens → Fine-grained tokens → select only
   the `art-by-zurc` repository, and set **Contents** to **Read and write**.
3. **Choose photos** to add pieces. Each photo starts a new piece with its own item
   number. To put several photos on one piece, open that piece and add them there.
   Large camera photos are shrunk in the browser before upload.
4. Open any piece to edit its number, title, price, size and notes, to reorder or
   remove photos, or to mark it **Sold**.
5. Press **Publish to the website**. Changes are live in about a minute.

Everything published is public, including prices and which pieces are sold.

## Printing the inventory

From the studio, **Print the inventory** (or add `#print` to the address). You get a
sheet of every piece — photo, item number, QR code, title, price, size and sold
status — with a date, a piece count and the total value of what is still available.
Choose 2, 3 or 4 per row, and whether to include sold pieces and QR codes.

Scanning a printed QR code opens that piece on the website.

> **Before printing tags you intend to keep:** set *Website address for QR codes* in
> the studio. Without it the codes encode whatever address the page is currently open
> at — which is wrong if you ever print from a copy on your own computer.

## Notes

- `catalogue.json` is the single source of truth; the site reads it on every load.
- An older catalogue file with a flat `photos` list is migrated to pieces
  automatically on load, one piece per photo.
- Item numbers must be unique. The studio refuses duplicates and fills in blanks.
