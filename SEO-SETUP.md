# Elastic Morph — Google & Bing auffindbar machen

**Problem:** Bei „elastic morph“ zeigt Google oft **VFX-Tutorials** (After Effects, Mesh Morphing) — nicht eure App.  
**Lösung:** Technische SEO (erledigt im Repo) + **Search Console** (einmal von dir) + **Marken-Suche** stärken.

---

## Was bereits auf elasticmorph.app liegt (nach Deploy)

| Datei | Zweck |
|-------|--------|
| `robots.txt` | Crawler dürfen alles indexieren, verweist auf Sitemap |
| `sitemap.xml` | Alle wichtigen URLs für Google/Bing |
| `index.html` | Klare Meta-Beschreibung + JSON-LD (`SoftwareApplication`) |
| `og.png` | Social Preview (TikTok/Reels → indirekt mehr Marken-Suchen) |

---

## Schritt 1 — Google Search Console (15 Min, einmalig)

1. Öffne [Google Search Console](https://search.google.com/search-console)
2. **Property hinzufügen** → URL-Präfix: `https://elasticmorph.app`
3. **Verifizierung** (eine Option reicht):
   - **DNS (empfohlen):** TXT-Eintrag bei Cloudflare für `elasticmorph.app`  
     *(Google zeigt dir Name + Wert)*
   - **HTML-Tag:** Meta-Tag in `index.html` einfügen (siehe unten)
4. Nach Verifizierung: **Sitemaps** → URL eintragen:  
   `https://elasticmorph.app/sitemap.xml` → **Senden**
5. **URL-Prüfung** → `https://elasticmorph.app/` → **Indexierung beantragen**
6. Dasselbe für `https://elasticmorph.app/elastic-morph.html`

### Optional: Verifizierungs-Meta-Tag

Wenn du die HTML-Methode wählst, füge in `index.html` im `<head>` ein:

```html
<meta name="google-site-verification" content="DEIN_CODE_VON_GOOGLE" />
```

Dann commit + deploy → in Search Console auf „Bestätigen“ klicken.

---

## Schritt 2 — Bing Webmaster Tools (optional, 5 Min)

1. [Bing Webmaster Tools](https://www.bing.com/webmasters)
2. Site hinzufügen → oft Import aus Google Search Console möglich
3. Sitemap: `https://elasticmorph.app/sitemap.xml`

---

## Schritt 3 — Realistische Erwartungen

| Suchanfrage | Schwierigkeit | Wann sichtbar? |
|-------------|---------------|----------------|
| **elastic morph app** | leicht | Tage–Wochen nach Index |
| **elasticmorph.app** | sehr leicht | oft sofort nach Index |
| **Elastic Morph music visual** | mittel | Wochen + Backlinks |
| **elastic morph** (generisch) | schwer | Konkurrenz: VFX, Papers, YouTube |

Google KI-Modus mischt **generische Begriffe** mit Fachwissen — das ist normal. Wichtig: Wer **Elastic Morph** oder **elasticmorph.app** sucht, soll euch finden.

---

## Schritt 4 — Was du ohne Code noch tun kannst

- **TikTok / Instagram Bio:** Link `https://elasticmorph.app` (läuft schon gut — 500+ Views!)
- **YouTube-Beschreibung** beim Reel: „Made with Elastic Morph → elasticmorph.app“
- **elasticuniverse.app** verlinkt Morph → stärkt Domain-Autorität
- **2–3 weitere Reels** mit gleichem Namen im Caption → Marken-Signale

---

## Checkliste

- [ ] Search Console: Property `elasticmorph.app` verifiziert
- [ ] Sitemap eingereicht
- [ ] Startseite + App-URL zur Indexierung beantragt
- [ ] Nach 7 Tagen: Search Console → „Leistung“ → Impressionen für „elastic morph“ prüfen

---

*Stand: Juli 2026 · Elastic Universe*
