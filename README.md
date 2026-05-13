# The Drink Is Right — Hugo Site
**Enhanced for Ages 25–55+ | Mobile Bartending NYC**

---

## Quick Start

### 1. Install Hugo
```bash
# macOS
brew install hugo

# Windows
choco install hugo-extended

# Linux
sudo snap install hugo
```

### 2. Run Locally
```bash
cd drinkisright
hugo server -D
```
Open → **http://localhost:1313**

### 3. Build for Production
```bash
hugo --minify
```
Deploy the `/public` folder to Netlify, Vercel, or any static host.

---

## Project Structure

```
drinkisright/
├── config.toml                     ← Site settings, phone, email, quote URL
├── content/
│   ├── _index.md                   ← Homepage SEO metadata
│   ├── about/_index.md             ← About page metadata
│   └── occasions/_index.md         ← Occasions page metadata
├── layouts/
│   ├── _default/baseof.html        ← Master HTML shell (fonts, head, body)
│   ├── partials/
│   │   ├── nav.html                ← Sticky navigation
│   │   └── footer.html             ← Footer with SEO keywords
│   ├── index.html                  ← Homepage (all sections)
│   ├── about/single.html           ← About page
│   └── occasions/single.html       ← Occasions detail page
└── static/
    ├── css/style.css               ← Full stylesheet
    ├── js/main.js                  ← Nav, reveal animations, smooth scroll
    └── images/                     ← Add your photos here
```

---

## Adding Your Photos

Place images in `static/images/`. Then update these CSS rules in `style.css`:

**Hero background** (line ~180):
```css
.hero-bg {
  background: linear-gradient(...),
    url('/images/hero-bg.jpg') center/cover no-repeat;
}
```

**Drink gallery cards** (lines ~260–270):
```css
.drink-img--a { background: url('/images/drink-1.jpg') center/cover; }
.drink-img--b { background: url('/images/drink-2.jpg') center/cover; }
.drink-img--c { background: url('/images/drink-3.jpg') center/cover; }
.drink-img--d { background: url('/images/drink-4.jpg') center/cover; }
```

**Recommended image sizes:**
- Hero: 1920×1080px minimum
- Drink cards: 600×700px minimum

---

## Customizing

| What | Where |
|---|---|
| Phone, email, quote URL | `config.toml` |
| Colors & fonts | `:root` block in `style.css` |
| Hero headline & copy | `layouts/index.html` |
| Services text | `layouts/index.html` → services section |
| Testimonials | `layouts/index.html` → testimonials section |
| Occasions details | `layouts/occasions/single.html` |
| About page text | `layouts/about/single.html` |

---

## Design System

**Fonts**
- Headlines: `Playfair Display` (editorial, timeless)
- Body: `DM Sans` (clean, modern, accessible)

**Colors**
```
--black:   #0C0C0C   (primary dark)
--gold:    #C9A84C   (milestone/luxury accent → 50–55+ appeal)
--green:   #1A6B47   (energy/vibrancy accent → 25–40 appeal)
--cream:   #FAF7F2   (warm, welcoming background)
```

**Why two accents?**
Gold signals sophistication and milestone energy for mature guests.
Forest green signals vitality and modern energy for younger guests.
Together, they create a palette that doesn't skew to either extreme.

---

## Age-Inclusive Features

| Feature | Younger (25–40) | Mature (50–55+) |
|---|---|---|
| Occasion cards | Birthday, house parties, bridal showers | Retirement, anniversary, milestone birthdays |
| Testimonials | Jasmine (30th bday), Priya & Marcus (wedding) | Robert (retirement), Margaret & Dennis (anniversary) |
| CTA copy | "Get a Free Quote" (digital-first) | "Call us directly" phone button always visible |
| BYOB service note | "Great for budget-conscious hosts" | — |
| Signature bar note | — | "Perfect for milestone birthdays & retirements" |
| Mocktail mention | ✓ | ✓ (more prominent in retirement/anniversary cards) |

---

## Deploying

**Netlify** (recommended — free tier works)
1. Push to GitHub
2. Connect repo in Netlify dashboard
3. Build command: `hugo --minify`
4. Publish directory: `public`

**Vercel**
1. Connect repo
2. Set framework preset to Hugo

**GitHub Pages**
1. Build locally with `hugo --minify`
2. Push `/public` to `gh-pages` branch

---

© 2025 The Drink Is Right
