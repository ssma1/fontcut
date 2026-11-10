const FIREBASE_DB_URL = "https://fontcuts-default-rtdb.firebaseio.com";
const BOT_REGEX = /telegrambot|twitterbot|facebookexternalhit|whatsapp|discordbot|vkshare|linkedinbot|yandexbot|googlebot|bingbot|applebot|slackbot|skypeuripreview/i;

export default async (request, context) => {
  const url = new URL(request.url);
  const userAgent = request.headers.get("user-agent") || "";

  // Пропускаем статические файлы
  if (url.pathname.match(/\.(js|css|png|jpg|jpeg|gif|svg|ico|json|woff|woff2|ttf)$/i)) {
    return context.next();
  }

  // Получаем ID шрифта из пути (например, /font/fc_12345)
  const pathParts = url.pathname.split("/").filter(Boolean);
  let fontId = null;
  if (pathParts[0] === "font" && pathParts[1]) {
    fontId = pathParts[1];
  } else if (url.searchParams.get("id")) {
    fontId = url.searchParams.get("id");
  }

  const isBot = BOT_REGEX.test(userAgent);

  // Если это не бот или нет ID — отдаем стандартную страницу
  if (!fontId || !isBot) {
    return context.next();
  }

  try {
    // Запрашиваем шрифт из Realtime Database
    const res = await fetch(`${FIREBASE_DB_URL}/fonts/${fontId}.json`);
    if (!res.ok) return context.next();
    
    const font = await res.json();
    
    // Если шрифт не найден или он не публичный — отдаем заглушку
    if (!font || font.visibility !== "public") {
      return context.next();
    }

    const title = font.name || "FontCut Шрифт";
    const description = font.meta?.description || "Иконочный шрифт, созданный в FontCut";
    // Если обложки нет, используем стандартный баннер
    const imageUrl = font.cover || `${url.origin}/fontcut-banner.png`;

    // Формируем HTML с мета-тегами
    const html = `<!DOCTYPE html>
<html lang="ru">
<head>
    <meta charset="UTF-8">
    <title>${escapeXml(title)} — FontCut</title>
    <meta name="description" content="${escapeXml(description)}">

    <!-- Open Graph -->
    <meta property="og:site_name" content="FontCut">
    <meta property="og:type" content="article">
    <meta property="og:title" content="${escapeXml(title)} — FontCut">
    <meta property="og:description" content="${escapeXml(description)}">
    <meta property="og:image" content="${imageUrl}">
    <meta property="og:image:secure_url" content="${imageUrl}">
    <meta property="og:url" content="${url.href}">

    <!-- Twitter / Telegram Large Card -->
    <meta name="twitter:card" content="summary_large_image">
    <meta name="twitter:title" content="${escapeXml(title)} — FontCut">
    <meta name="twitter:description" content="${escapeXml(description)}">
    <meta name="twitter:image" content="${imageUrl}">
</head>
<body>
    <h1>${escapeXml(title)}</h1>
    <p>${escapeXml(description)}</p>
    <img src="${imageUrl}" alt="Cover">
</body>
</html>`;

    return new Response(html, {
      headers: {
        "Content-Type": "text/html; charset=utf-8",
        "Cache-Control": "public, max-age=300, s-maxage=300"
      }
    });

  } catch (err) {
    console.error("OG Generator Error:", err);
    return context.next();
  }
};

function escapeXml(unsafe) {
  return String(unsafe)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&apos;");
}

export const config = {
  path: ["/*"],
};
