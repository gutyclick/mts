import fs from "node:fs";
const files = {
  es: {
    terms: "terminos",
    privacy: "privacidad",
    refunds: "reembolsos",
    cookies: "cookies",
  },
  en: {
    terms: "terms.en",
    privacy: "privacy.en",
    refunds: "refunds.en",
    cookies: "cookies.en",
  },
};
const clean = (s) => s.replace(/\*\*/g, "").replace(/`/g, "").trim();
export function parseLegalMarkdown(text) {
  const lines = text.replace(/^\uFEFF/, "").split(/\r?\n/),
    sections = [];
  let title = "",
    section = null;
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i].trim();
    if (!line) continue;
    if (line.startsWith("# ")) {
      title = clean(line.slice(2));
      continue;
    }
    if (line.startsWith("## ")) {
      section = {
        id: `section-${sections.length + 1}`,
        title: clean(line.slice(3)),
        blocks: [],
      };
      sections.push(section);
      continue;
    }
    if (!section) throw Error("Text outside section: " + line);
    if (line.startsWith("|")) {
      const rows = [];
      while (i < lines.length && lines[i].trim().startsWith("|")) {
        const cells = lines[i].trim().split("|").slice(1, -1).map(clean);
        if (!cells.every((c) => /^:?-+:?$/.test(c))) rows.push(cells);
        i++;
      }
      i--;
      section.blocks.push({ type: "table", headers: rows.shift(), rows });
    } else if (line.startsWith("- ")) {
      const items = [];
      while (i < lines.length && lines[i].trim().startsWith("- ")) {
        items.push(clean(lines[i].trim().slice(2)));
        i++;
      }
      i--;
      section.blocks.push({ type: "list", items });
    } else {
      let paragraph = line;
      while (
        i + 1 < lines.length &&
        lines[i + 1].trim() &&
        !/^(?:#|\||- )/.test(lines[i + 1].trim())
      )
        paragraph += " " + lines[++i].trim();
      section.blocks.push({ type: "paragraph", text: clean(paragraph) });
    }
  }
  if (!title || sections.length < 5) throw Error("Incomplete legal document");
  return { title, sections };
}
const result = {};
for (const [locale, documents] of Object.entries(files)) {
  result[locale] = {};
  for (const [key, file] of Object.entries(documents)) {
    const doc = parseLegalMarkdown(
      fs.readFileSync(`docs/legal/${file}.md`, "utf8"),
    );
    if (
      /Borrador|Pendiente de|Antes de publicar|Decisión comercial pendiente/.test(
        JSON.stringify(doc),
      )
    )
      throw Error(`Unfinished ${file}`);
    result[locale][key] = doc;
  }
}
fs.writeFileSync(
  "src/content/legal.json",
  JSON.stringify(result, null, 2) + "\n",
);
console.log("Generated eight localized legal documents.");
