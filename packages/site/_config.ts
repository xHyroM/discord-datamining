import lume from "https:/deno.land/x/lume@v1.7.2/mod.ts";
import postcss from "https:/deno.land/x/lume@v1.7.2/plugins/postcss.ts";
import resolveUrls from "https:/deno.land/x/lume@v1.7.2/plugins/resolve_urls.ts";
import esbuild from "https:/deno.land/x/lume@v1.7.2/plugins/esbuild.ts";

const site = lume(
  {
    src: "./src",
    location: new URL("https://xhyrom.github.io/discord-datamining"),
  },
);

site
  .copy("static", ".")
  .use(resolveUrls())
  .use(postcss())
  .use(esbuild({
    extensions: [".js", ".ts"],
  }))
  .scopedUpdates(
    (path) => path.endsWith(".css"),
    (path) => path.endsWith(".png") || path.endsWith(".jpg"),
  )
  // Filters
  .filter("split", (str, separator) => str.split(separator))
  .filter("slice", (arr, length) => arr.slice(0, length));

export default site;
