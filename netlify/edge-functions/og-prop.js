// Netlify Edge Function: og-prop
// Unico efecto: cuando un rastreador social (WhatsApp / Facebook / etc.) abre la
// home con ?prop=ID, se le entrega la version server-side de la propiedad, que ya
// incluye la foto principal en las etiquetas Open Graph (og:image).
// Los visitantes HUMANOS no se ven afectados: pasan de largo a la home normal (SPA).
// No modifica index.html, ni netlify.toml, ni estilos: solo se agrega este archivo.

export default async (request, context) => {
  const url = new URL(request.url);
  const prop = url.searchParams.get("prop");
  if (!prop) return; // sin ?prop -> home normal, sin cambios

  const ua = (request.headers.get("user-agent") || "").toLowerCase();
  const isCrawler = /facebookexternalhit|facebookcatalog|facebot|whatsapp|twitterbot|slackbot|slack-imgproxy|telegrambot|linkedinbot|discordbot|pinterest|redditbot|skypeuripreview|embedly|vkshare|applebot|bingbot|googlebot/.test(ua);
  if (!isCrawler) return; // humanos -> home normal (SPA), sin cambios

  // Rastreador: servir la pagina server-side con OG de la propiedad, manteniendo la URL
  return context.rewrite(`/propiedad/${encodeURIComponent(prop)}`);
};

export const config = { path: "/" };
