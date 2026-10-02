// Builds the browser-only SahiSehat preview as one self-contained HTML file.
// React loads from cdnjs (UMD globals); everything else is inlined.
import { build } from "esbuild";
import { execSync } from "node:child_process";
import { mkdirSync, readFileSync, writeFileSync } from "node:fs";

const OUT = process.argv[2] || "demo/dist";
mkdirSync(OUT, { recursive: true });

const globals = {
  react: "window.React",
  "react-dom/client": "window.ReactDOM",
  "react/jsx-runtime": null,
};

const res = await build({
  entryPoints: ["demo/app.tsx"],
  bundle: true,
  write: false,
  format: "iife",
  minify: true,
  target: "es2020",
  jsx: "automatic",
  define: { "process.env.SAHI_AS_OF": "undefined", "process.env.NODE_ENV": '"production"' },
  plugins: [
    {
      name: "globals",
      setup(b) {
        b.onResolve({ filter: /^(react|react-dom\/client|react\/jsx-runtime)$/ }, (a) => ({ path: a.path, namespace: "g" }));
        b.onLoad({ filter: /.*/, namespace: "g" }, (a) => {
          if (a.path === "react/jsx-runtime") {
            return {
              contents: `const R = window.React;
function mk(type, props, key) { const p = Object.assign({}, props); if (key !== undefined) p.key = key; const c = p.children; delete p.children; return c === undefined ? R.createElement(type, p) : Array.isArray(c) ? R.createElement(type, p, ...c) : R.createElement(type, p, c); }
export const jsx = mk; export const jsxs = mk; export const Fragment = R.Fragment;`,
              loader: "js",
            };
          }
          return { contents: `module.exports = ${globals[a.path]};`, loader: "js" };
        });
      },
    },
  ],
});
const js = res.outputFiles[0].text.replace(/<\/script/gi, "<\\/script");

execSync(`npx @tailwindcss/cli -i demo/styles.css -o ${OUT}/styles.css --minify`, { stdio: "inherit" });
const css = readFileSync(`${OUT}/styles.css`, "utf8");

const html = `<title>SahiSehat</title>
<meta name="description" content="Lab-tested food, matched to your body.">
<link rel="preconnect" href="https://fonts.googleapis.com">
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Atkinson+Hyperlegible:wght@400;700&family=Bricolage+Grotesque:opsz,wght@12..96,600;12..96,700&display=swap">
<style>${css}</style>
<div id="root"></div>
<script src="https://cdnjs.cloudflare.com/ajax/libs/react/18.3.1/umd/react.production.min.js"></script>
<script src="https://cdnjs.cloudflare.com/ajax/libs/react-dom/18.3.1/umd/react-dom.production.min.js"></script>
<script>${js}</script>
`;
writeFileSync(`${OUT}/sahisehat.html`, html);
console.log(`wrote ${OUT}/sahisehat.html (${(html.length / 1024).toFixed(0)} KB)`);
