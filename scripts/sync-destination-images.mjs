import { readdir, readFile, writeFile } from "node:fs/promises";
const destinations = JSON.parse(
  await readFile("src/data/destinations.json", "utf8"),
);
const normalize = (value) =>
  value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]/g, "");
const files = (await readdir("public/images/destinations"))
  .filter((file) => /\.(png|jpe?g|webp|avif)$/i.test(file))
  .sort();
const images = {};
const filenameAliases = {
  "nulgaria.png": "bulgaria",
  "bosnia y hezergovina.png": "bosnia-and-herzegovina",
};
for (const destination of destinations) {
  const names = [
    destination.slug,
    destination.code,
    destination.name.en,
    destination.name.es,
    ...destination.aliases,
  ].map(normalize);
  const file = files.find(
    (file) =>
      filenameAliases[file] === destination.slug ||
      names.includes(normalize(file.replace(/\.[^.]+$/, ""))),
  );
  if (file) images[destination.slug] = `/images/destinations/${file}`;
}
await writeFile(
  "src/data/destination-images.json",
  JSON.stringify(images, null, 2) + "\n",
);
console.log(`Matched ${Object.keys(images).length} destination banners.`);
