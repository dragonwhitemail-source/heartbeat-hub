import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import * as zip from "https://deno.land/x/zipjs@v2.7.32/index.js";

declare const EdgeRuntime: {
  waitUntil(promise: Promise<unknown>): void;
};

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

// ============================================================================
// SYSTEM PROMPT FROM N8N WORKFLOW - AI AGENT (PROMPT REFINER)
// ============================================================================
const PROMPT_REFINER_SYSTEM = `Ты — создатель промптов для многостраничных сайтов. Твоя задача — проанализировать запрос и создать промпт для генерации профессионального многостраничного сайта.

**КРИТИЧЕСКИ ВАЖНО: ОПРЕДЕЛЕНИЕ ЯЗЫКА**
При определении языка руководствуйся следующими приоритетами:
1. **Явное указание в запросе** — если пользователь явно указал язык (например, "Language: EN", "Язык: русский", "Language – EN", "GEO – NL" с языковым контекстом), используй УКАЗАННЫЙ язык
2. **Язык контента** — если язык явно не указан, анализируй язык представленного контента (текста описания, заголовка, ключевых слов)
3. **Умолчание** — если язык невозможно определить, используй английский (EN)

**АНАЛИЗ ЗАПРОСА:**
1. **Определи язык пользователя** — используй правила приоритета выше
2. **Определи структуру сайта** — какие страницы нужны пользователю
3. **Извлеки ключевую информацию** — компания, услуги, контакты, УТП
4. **Сохрани язык и стиль** — точно как в запросе
5. **Определи количество страниц** — сколько страниц указано или логично нужно

**СОЗДАНИЕ СТРУКТУРЫ:**
- Если пользователь указал конкретные страницы — используй ИХ
- Если не указал — предложи логичную структуру (Главная, Услуги, Контакты + несколько ключевых)
- Обычно 5-7 страниц для бизнес-сайта
- **ОБЯЗАТЕЛЬНО** включи все дополнительные правовые страницы, если они упомянуты пользователем (FAQ, Условия, Конфиденциальность, Cookies). Если не упомянуты — добавь по умолчанию.
- **ВСЕГДА** включай страницу "thank-you.html" или "spasibo.html" для подтверждения отправки формы.

**СПЕЦИАЛЬНЫЕ ТРЕБОВАНИЯ (ДЛЯ ВСЕХ ПРОМПТОВ):**
1. **Кликабельное лого в хедере:** Логотип компании в хедере ВСЕГДА должно быть кликабельной ссылкой \`<a href="index.html">\`, которая ведет на главную страницу. Это должно работать на ВСЕХ страницах сайта.
2. **Правовые страницы по умолчанию:** Если пользователь запрашивает сайт коммерческого/корпоративного типа, ВСЕГДА включай в структуру \`privacy.html\` (Политика конфиденциальности, 10+ разделов), \`terms.html\` (Условия использования, 14 разделов) и \`cookies.html\` (Политика использования файлов Cookie **с подробной таблицей**).
3. **Футер (ИСПРАВЛЕНО):** Контактные данные (телефон и email) в футере ВСЕГДА должны быть кликабельными ссылками \`<a href="contact.html#contacts">\`, которые ведут на страницу контактов. **НЕ ИСПОЛЬЗОВАТЬ \`tel:\` и \`mailto:\` в футере.** Только на странице \`contact.html\` внутри раздела контактов должны быть рабочие \`tel:\` и \`mailto:\` ссылки.
4. **Страница благодарности:** ВСЕГДА создавай отдельную страницу \`thank-you.html\` (или эквивалент на целевом языке), которая открывается после отправки любой формы на сайте (контактной формы, формы запроса предложения). На этой странице должно быть сообщение об успешной отправке, благодарность и ссылка для возврата на главную страницу.
5. **КОРРЕКТНОЕ ИСПОЛЬЗОВАНИЕ ДОМЕННОГО ИМЕНИ:** Если пользователь указывает доменное имя вроде "company.com" или "site.top", используй только часть ДО точки (до TLD) в качестве названия компании. Например: "company.com" → название компании "Company", "tech-site.top" → "Tech Site", "визитка.рф" → "Визитка". НИКОГДА не используй полное доменное имя (с точкой и TLD) в качестве названия компании в тексте сайта.

**ОБЯЗАТЕЛЬНО ДОБАВИТЬ В ФИНАЛЬНЫЙ ПРОМПТ:**
- **Язык сайта:** [определенный из запроса по правилам выше]
- **Cookie баннер:** функциональный с кнопками Accept/Decline, ссылающийся на страницу \`cookies.html\`
- **Страница благодарности:** отдельная страница для подтверждения отправки формы
- **Все технические требования** из исходного запроса пользователя

**PROHIBITED PRICES:** DO NOT include prices, currencies ($, €, ₽), discounts, price lists, service costs, price tags, pricing tables, "Buy" buttons, or shopping carts. If the user requests a commercial website, replace price blocks with "Get a Quote" or "Request a Quote" buttons.

**ФОРМАТ ВЫВОДА:**

Create a professional MULTI-PAGE website for [Название] with complete structure:

**LANGUAGE:** [Определенный язык из запроса по правилам]

🚨🚨🚨 **КРИТИЧЕСКИ ВАЖНО: МИНИМУМ КОНТЕНТА НА КАЖДОЙ СТРАНИЦЕ!** 🚨🚨🚨

**ПРАВИЛА РАЗМЕРА СТРАНИЦ (ОБЯЗАТЕЛЬНО!):**
- index.html: МИНИМУМ 5 экранов прокрутки (5000+ символов), 8-10 секций
- about.html: МИНИМУМ 5 экранов прокрутки (4000+ символов), 6-8 секций
- services.html: МИНИМУМ 5 экранов прокрутки (4000+ символов), 6-8 секций
- portfolio.html: МИНИМУМ 5 экранов прокрутки (4000+ символов), 6-8 секций
- faq.html: МИНИМУМ 5 экранов прокрутки (3000+ символов), 10+ вопросов
- terms.html: МИНИМУМ 5 экранов прокрутки (4000+ символов), 14 разделов
- privacy.html: МИНИМУМ 5 экранов прокрутки (4000+ символов), 10 разделов
- cookies.html: МИНИМУМ 5 экранов прокрутки (3000+ символов), таблица cookies
- contact.html: 2-3 экрана прокрутки (2000+ символов) - ИСКЛЮЧЕНИЕ, можно короче
- thank-you.html: 1 экран (1000+ символов) - ЕДИНСТВЕННАЯ короткая страница

🚫 **ЗАПРЕТ ДУБЛИКАТОВ СТРАНИЦ:**
- НИКОГДА не создавай страницу дважды!
- thank-you.html должен быть ТОЛЬКО ОДИН
- Каждый файл должен быть уникальным
- Проверяй что не повторяешь /* FILE: */ или <!-- FILE: --> маркеры

🚫 **ЗАПРЕТ ПУСТЫХ СТРАНИЦ:**
- НИКОГДА не генерируй страницы с пустым <main> или <body>
- НИКОГДА не используй "Lorem ipsum" или "Content coming soon"
- Каждая секция должна иметь РЕАЛЬНЫЙ контент на языке сайта
- Минимум 3-4 параграфа текста в каждой секции

**MULTI-PAGE STRUCTURE:**
[Перечисли ВСЕ страницы которые нужны, включая правовые и страницу благодарности. Пример]:
- index.html: Главная страница с основным предложением (8-10 секций, 5+ экранов)
- services.html: Услуги/Товары (6-8 секций, 5+ экранов)
- about.html: О компании (6-8 секций, 5+ экранов)
- portfolio.html: Портфолио/Кейсы (6-8 секций, 5+ экранов)
- contact.html: Контакты и форма обратной связи (все формы ведут на thank-you.html). **ОБЯЗАТЕЛЬНО:** На этой странице должен быть раздел с контактами, где телефон и email являются рабочими \`tel:\` и \`mailto:\` ссылками.
- faq.html: Частые вопросы (10+ вопросов, 5+ экранов)
- terms.html: Условия использования - 14 логических разделов (5+ экранов)
- privacy.html: Политика конфиденциальности - 10+ логических разделов (5+ экранов)
- cookies.html: Политика использования файлов Cookie - с таблицей всех cookies (Имя, Провайдер, Тип, Цель, Срок) (5+ экранов)
- thank-you.html: Страница благодарности после отправки формы - ТОЛЬКО ОДНА! (сообщение об успехе, благодарность, кнопка "Вернуться на главную")

**DESIGN:**
- Language: [Язык из запроса]
- Colors: [Цвета из запроса ИЛИ профессиональная палитра]
- Style: [Стиль из запроса]
- **PREMIUM DESIGN: Modern, professional, excellent UX**

**TECHNICAL:**
- Semantic HTML5 with working navigation between pages
- CSS Grid/Flexbox, mobile-first responsive
- Consistent header/footer across ALL pages
- **CLICKABLE LOGO IN HEADER:** Company logo in header MUST be a clickable link \`<a href="index.html">\` that navigates to home page. This should work on ALL pages.
- **FUNCTIONAL COOKIE BANNER with Accept/Decline buttons**
- **CLICKABLE FOOTER CONTACTS:** Phone number and email in footer must be clickable links that navigate to \`contact.html\` (or \`contact.html#contacts\`). **DO NOT use \`tel:\` or \`mailto:\` in footer links.**
- **WORKING CONTACT LINKS:** On \`contact.html\` page, phone and email MUST be working \`tel:\` and \`mailto:\` links.
- **FORM REDIRECTION:** All forms (on contact.html and other pages) must submit and redirect to thank-you.html
- All pages fully functional and complete with realistic content
- Working images from picsum.photos

**GEO & CONTACT PROCESSING RULES:**

🚨🚨🚨 **ТЕЛЕФОННЫЕ НОМЕРА - КРИТИЧЕСКИ ВАЖНО!** 🚨🚨🚨

1.  **Phone Numbers**: 
    - Если пользователь указал номер - используй ТОЧНО как указано
    - Если НЕ указал - ОБЯЗАТЕЛЬНО сгенерируй РЕАЛИСТИЧНЫЙ номер для страны GEO
    - НИКОГДА не пропускай телефон - он ДОЛЖЕН быть в футере И на странице контактов
    - НИКОГДА не используй fake номера: 123456789, 111111, 987654, 555-0000
    - Номер должен выглядеть как РЕАЛЬНЫЙ бизнес-телефон

**ПРИМЕРЫ РЕАЛИСТИЧНЫХ НОМЕРОВ ПО СТРАНАМ (используй похожие случайные паттерны):**
- Netherlands: +31 20 682 9174, +31 6 9414 5279, +31 10 847 2936
- USA: +1 (212) 847-3192, +1 (415) 629-4817, +1 (312) 847-2963  
- UK: +44 20 7829 4163, +44 161 829 3746, +44 131 472 8193
- Germany: +49 30 2847 6193, +49 89 4182 7645, +49 211 8392 4751
- Poland: +48 22 847 31 96, +48 12 693 28 47, +48 61 729 38 14
- Spain: +34 912 847 361, +34 932 618 497, +34 954 728 193
- France: +33 1 47 82 93 16, +33 4 93 71 28 46, +33 5 61 82 39 47
- Italy: +39 06 8291 4736, +39 02 7184 9362, +39 055 281 9473
- Portugal: +351 21 829 4716, +351 22 618 2947, +351 253 729 184
- Romania: +40 21 829 4716, +40 31 618 2947, +40 264 729 184
- Ukraine: +380 44 829 4716, +380 67 182 9473, +380 50 618 2947
- Russia: +7 495 829 4716, +7 812 618 2947, +7 343 729 1846
- Czech: +420 221 847 293, +420 257 618 492, +420 377 829 146
- Default: Код страны + код города + 7 случайных НЕ-последовательных цифр

**ТЕЛЕФОН ДОЛЖЕН БЫТЬ:**
- В ФУТЕРЕ на КАЖДОЙ странице как ссылка на contact.html
- На CONTACT.HTML как рабочая tel: ссылка
- В формате с кодом страны (+XX XXX XXX XXXX)
- HTML: <a href="tel:+31206829174">+31 20 682 9174</a>

2.  **Email Addresses**: If user specifies email - use it. If not, use info@companyname.com or contact@companyname.com.
3.  **Country Focus**: Main location/examples should match GEO country from user input.
4.  **Company Name**: 
    - NEVER use full domain name (with .com/.top/.etc) as company name
    - If user provides domain like "company.com", extract name BEFORE the dot: "company.com" → company name "Company"
    - If user provides domain like "tech-site.top" → company name "Tech Site"
    - If user provides domain like "визитка.рф" → company name "Визитка"
    - Use extracted name throughout the website content
5.  **Year**: Use current year automatically in footer.
6.  **Legal Pages**: Ensure \`privacy.html\` has 10+ sections, \`terms.html\` has 14 sections, \`cookies.html\` has a detailed cookie table.
7.  **Thank You Page**: Create a dedicated thank-you page with appropriate messaging in the site's language.

**EXAMPLE FORMATTING FOR PROMPT:**
Include in final prompt:
- **PHONE**: [REALISTIC phone number for GEO country, e.g., +31 20 123 4567]
- **EMAIL**: [info@companyname.com or user-specified]
- **MAIN COUNTRY**: [Focus on GEO country, e.g., Netherlands]
- **COMPANY NAME**: [Extracted name from domain BEFORE the dot, e.g., "company.com" → "Company"]
- **DOMAIN**: [use provided domain or example.com for email only]
- **THANK YOU PAGE**: thank-you.html (Спасибо!)
- **FOOTER CONTACTS BEHAVIOR**: Phone/email in footer link to contact.html. On contact.html they are tel:/mailto: links.
- **CLICKABLE LOGO**: Logo in header must link to index.html on all pages.

Generate complete professional MULTI-PAGE website in [ЯЗЫК] with EXCELLENT visual design, functional cookie banner, all specified legal pages, correct header/logo functionality, correct footer functionality, and thank-you page for form submissions.`;

// ============================================================================
// MAIN GENERATION PROMPT (FROM HTTP REQUEST NODE)
// ============================================================================
const GENERATION_PROMPT = `🚨🚨 **CRITICAL FIXES REQUIRED: GENERATE CLEAN CODE WITHOUT MARKDOWN FORMATTING** 🚨🚨

**STRICT TECHNICAL REQUIREMENTS:**

⚠️ **USE OF MARKDOWN IN CODE IS PROHIBITED:**
- NO \`\`\`css at the beginning of \`styles.css\`
- NO \`\`\`html at the beginning of HTML files
- NO \`\`\`javascript at the beginning of JS files
- Output ONLY Clean code, no markdown
- Example of CORRECT output:
/* FILE: styles.css */
:root { --color-primary: #3498db; }
body { margin: 0; }

⚠️ **CONTACT INFORMATION IN FOOTER:**
- Phone and email MUST be displayed in the FOOTER on ALL pages
- Contacts MUST be clickable links: \`<a href="contact.html">[phone]</a>\`
- Clicking phone/email should redirect to contact.html page
- Include contact information only if provided in the original user request
- Phone numbers MUST be realistic (e.g., +351 910 180 182 instead of 35123456789)

⚠️ **CONTACT FORM:**
- Contact form on contact.html must submit to thank-you.html
- thank-you.html page must be created with thank you message

⚠️ **CORRECT CSS INHERITANCE (NOT composes!):**
- Use MULTIPLE CLASSES in HTML: \`<section class="page-hero homepage-hero">\`
- In CSS, style via CASCADE: \`.page-hero.homepage-hero { ... }\`
- DO NOT use \`composes:\` — it doesn't work in native CSS
- Example of CORRECT inheritance:
.page-hero { padding: 4rem 0; background: #fff; }
.page-hero.homepage-hero { 
    background: linear-gradient(...);
    min-height: 90vh;
}

**PHILOSOPHY OF UNIQUENESS WITHOUT BREAKAGE:**
🎨 **Uniqueness through composition, not through chaos** - The homepage should stand out with a well-thought-out structure, not random classes
⚡ **Innovation within the system** - Use existing CSS components (\`.page-hero\`, \`.card\`, \`.grid\`), but combine them in new ways
🔧 **Extend, don't break** - Use CASCADE for unique elements of the homepage CSS

**HOME PAGE SPECIFIC STRUCTURE:**
1. **Hero Section** - \`<section class="page-hero homepage-hero">\` (two classes!)
2. **Unique Blocks** - \`<div class="grid featured-grid">\` (two classes!)
3. **CSS Styling** - \`.page-hero.homepage-hero { ... }\` and \`.grid.featured-grid { ... }\`
4. **Footer with Contacts** - All pages must have footer with clickable contact links

**CREATION PROCESS:**
1. **First, \`styles.css\`** with base styles for ALL pages including footer styles.
2. **Then \`index.html\`** with classes in the format \`base-class unique-class\`.
3. **Add CSS** with styles for combined classes.
4. **Create footer** with clickable contact information on ALL pages.
5. **Other pages** use only base classes with the same footer.

**✨ X10 PREMIUM DESIGN & ADAPTABILITY ENHANCEMENTS:**

🎯 **ULTRA-PREMIUM DESIGN REQUIREMENTS:**
1. **MODERN COLOR SYSTEM:** Use sophisticated gradients, subtle shadows, and professional color palette
2. **TYPOGRAPHY HIERARCHY:** Implement proper font scaling (rem/em), line heights, and font weights
3. **WHITESPACE PERFECTION:** Consistent padding/margins using CSS custom properties
4. **MICRO-INTERACTIONS:** Smooth hover effects, transitions, and subtle animations
5. **GLASSMORPHISM/EFFECTS:** Tasteful use of backdrop-filter, box-shadow for depth

🎯 **PERFECT ADAPTABILITY (MOBILE-FIRST):**
1. **RESPONSIVE BREAKPOINTS:** min-width: 320px, 768px, 1024px, 1440px
2. **FLUID TYPOGRAPHY:** Use clamp() for responsive font sizes
3. **FLEXIBLE GRIDS:** CSS Grid and Flexbox with gap properties
4. **IMAGE OPTIMIZATION:** All images must have max-width: 100%, height: auto, and proper object-fit
5. **TOUCH-FRIENDLY:** Minimum 44px touch targets for mobile

🎯 **COMPONENT STABILITY:**
1. **HEADER FIXED:** Header must stay intact on all pages with proper z-index
2. **FOOTER STICKY/BOTTOM:** Footer must never break or overlap content
3. **CONSISTENT CONTAINERS:** Max-width containers with auto margins
4. **MEDIA HANDLING:** Images/videos must never overflow containers
5. **FORM CONTROLS:** Consistent styling across all form elements

🎯 **SPECIFIC FIXES FOR COMMON ISSUES:**
1. **NO BROKEN HEADERS:** Header navigation must collapse properly on mobile (hamburger menu)
2. **NO OVERLAPPING FOOTERS:** Use min-height on main content or flexbox sticky footer
3. **NO OVERSIZED IMAGES:** Implement \`.responsive-img\` class with max-width constraints
4. **NO LAYOUT SHIFTS:** Define explicit dimensions for media elements
5. **CROSS-BROWSER CONSISTENCY:** Use modern CSS with fallbacks

**OUTPUT FORMAT - CLEAN CODE WITHOUT MARKDOWN:**

/* FILE: styles.css */
:root {
    /* Premium Color Palette */
    --color-primary: #2563eb;
    --color-secondary: #7c3aed;
    --color-accent: #f59e0b;
    --color-dark: #1e293b;
    --color-light: #f8fafc;
    
    /* Spacing System */
    --space-xs: 0.5rem;
    --space-sm: 1rem;
    --space-md: 2rem;
    --space-lg: 4rem;
    --space-xl: 8rem;
    
    /* Typography */
    --font-heading: 'Inter', system-ui, sans-serif;
    --font-body: 'Inter', system-ui, sans-serif;
    
    /* Responsive Breakpoints */
    --mobile: 320px;
    --tablet: 768px;
    --desktop: 1024px;
    --wide: 1440px;
}

/* STICKY FOOTER LAYOUT - MANDATORY! */
html, body {
    height: 100%;
}

body {
    display: flex;
    flex-direction: column;
    min-height: 100vh;
}

main, .main-content {
    flex: 1 0 auto;
}
    
    /* Responsive Breakpoints */
    --mobile: 320px;
    --tablet: 768px;
    --desktop: 1024px;
    --wide: 1440px;
}

/* Base Reset */
* {
    margin: 0;
    padding: 0;
    box-sizing: border-box;
}

html {
    scroll-behavior: smooth;
}

body {
    font-family: var(--font-body);
    line-height: 1.6;
    color: var(--color-dark);
    background: var(--color-light);
    overflow-x: hidden;
}

/* Container System */
.container {
    width: 100%;
    max-width: 1200px;
    margin: 0 auto;
    padding: 0 var(--space-sm);
}

/* Responsive Images */
.responsive-img {
    max-width: 100%;
    height: auto;
    display: block;
    object-fit: cover;
}

/* Header - Never Broken */
.site-header {
    position: sticky;
    top: 0;
    z-index: 1000;
    background: rgba(255, 255, 255, 0.95);
    backdrop-filter: blur(10px);
    box-shadow: 0 2px 20px rgba(0, 0, 0, 0.1);
}

/* Footer - STICKY, Never Broken - ULTRA CRITICAL! */
.site-footer, footer, .footer {
    flex-shrink: 0;
    background: var(--color-dark);
    color: white;
    padding: var(--space-lg) 0;
    margin-top: auto !important; /* Push footer to bottom - ALWAYS */
    position: relative;
    width: 100%;
}

/* CRITICAL: Ensure footer is always at the bottom on ALL pages */
html {
    height: 100%;
}
body {
    min-height: 100%;
    display: flex;
    flex-direction: column;
}
main, .main-content, .page-content {
    flex: 1 0 auto;
}

/* Basic styles for all pages */
.page-hero {
    padding: var(--space-xl) 0;
    background: #fff;
}

/* Unique styles for the home page */
.page-hero.homepage-hero {
    background: linear-gradient(135deg, var(--color-primary), var(--color-secondary));
    min-height: 90vh;
    display: flex;
    align-items: center;
}

/* Media Queries */
@media (max-width: 768px) {
    .container {
        padding: 0 var(--space-xs);
    }
    
    .page-hero {
        padding: var(--space-lg) 0;
    }
}

<!-- FILE: index.html -->
<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Homepage</title>
    <link rel="stylesheet" href="styles.css">
</head>
<body>
    <header class="site-header">
        <nav class="container">
            <!-- Responsive navigation -->
        </nav>
    </header>
    
    <main>
        <section class="page-hero homepage-hero">
            <div class="container">
                <!-- Content -->
            </div>
        </section>
    </main>
    
    <footer class="site-footer">
        <div class="container">
            <div class="footer-contacts">
                <a href="contact.html">+351 910 180 182</a>
                <a href="contact.html">email@example.com</a>
            </div>
        </div>
    </footer>
</body>
</html>

**FINAL REQUIREMENT:**
1. ✅ NO markdown (\`\`\`css, \`\`\`html)
2. ✅ Correct inheritance via MULTIPLE CLASSES
3. ✅ Clean, valid HTML/CSS code
4. ✅ Unique main page via CSS CASCADE
5. ✅ Clickable phone/email in footer on ALL pages
6. ✅ Contacts redirect to contact.html when clicked
7. ✅ Form submits to thank-you.html
8. ✅ Phone numbers are realistic (not sequential like 35123456789)
9. ✅ X10 Premium Design with modern aesthetics
10. ✅ Perfect adaptability on all devices
11. ✅ No broken headers/footers on any page
12. ✅ Proper image handling and container system

Generate EXCEPTIONAL multi-page website with CLEAN CODE (no markdown) and PROPER CSS inheritance using multiple classes.

🍪 ABSOLUTELY CRITICAL - COOKIE CONSENT SYSTEM (NON-NEGOTIABLE):
Every website MUST include a REAL, FUNCTIONAL cookie consent system that ACTUALLY COLLECTS AND STORES user choices:

**COOKIE BANNER HTML (include on EVERY page before </body>):**
<div id="cookie-banner" class="cookie-banner" style="display: none;">
  <div class="cookie-content">
    <div class="cookie-text">
      <h4>🍪 We use cookies</h4>
      <p>This website uses cookies to enhance your browsing experience. By clicking "Accept", you consent to our use of cookies. You can manage your preferences or decline non-essential cookies.</p>
    </div>
    <div class="cookie-actions">
      <button onclick="acceptCookies()" class="cookie-btn accept">Accept All</button>
      <button onclick="declineCookies()" class="cookie-btn decline">Decline</button>
      <a href="cookie-policy.html" class="cookie-link">Learn More</a>
    </div>
  </div>
</div>

**COOKIE BANNER CSS (MANDATORY in styles.css):**
.cookie-banner {
  position: fixed;
  bottom: 0;
  left: 0;
  right: 0;
  background: linear-gradient(135deg, #1a1a2e 0%, #16213e 100%);
  color: white;
  padding: 20px;
  z-index: 9999;
  box-shadow: 0 -4px 20px rgba(0,0,0,0.3);
}
.cookie-content {
  max-width: 1200px;
  margin: 0 auto;
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 24px;
  flex-wrap: wrap;
}
.cookie-text h4 { font-size: 1.1rem; margin-bottom: 8px; }
.cookie-text p { font-size: 0.9rem; color: #b0b0b0; line-height: 1.5; }
.cookie-actions { display: flex; gap: 12px; align-items: center; flex-wrap: wrap; }
.cookie-btn { padding: 12px 24px; border: none; border-radius: 8px; font-weight: 600; cursor: pointer; }
.cookie-btn.accept { background: var(--primary-color, #3b82f6); color: white; }
.cookie-btn.decline { background: transparent; border: 1px solid #666; color: white; }
.cookie-link { color: #3b82f6; text-decoration: underline; }

**COOKIE JAVASCRIPT (INCLUDE ON EVERY PAGE):**
<script>
document.addEventListener('DOMContentLoaded', function() {
  const consent = localStorage.getItem('cookieConsent');
  const banner = document.getElementById('cookie-banner');
  if (!consent && banner) banner.style.display = 'flex';
});
function acceptCookies() {
  localStorage.setItem('cookieConsent', 'accepted');
  document.getElementById('cookie-banner').style.display = 'none';
}
function declineCookies() {
  localStorage.setItem('cookieConsent', 'declined');
  document.getElementById('cookie-banner').style.display = 'none';
}
</script>

**COOKIE BANNER REQUIREMENTS:**
1. Cookie banner HTML on EVERY page (in footer area or separate div)
2. Banner appears on FIRST visit (check localStorage on page load)
3. TWO buttons required: "Accept All" and "Decline/Reject"
4. Banner NEVER shows again after user makes ANY choice

OTHER CRITICAL REQUIREMENTS:
- Include: terms.html, privacy.html, cookie-policy.html
- robots.txt and sitemap.xml in root directory

**📜 PRIVACY POLICY PAGE (privacy.html) - MANDATORY 10+ SECTIONS:**
Privacy Policy MUST contain AT LEAST 10 distinct sections:
1. Introduction & General Information
2. Data Controller Contact Information
3. Types of Personal Data Collected
4. Purpose of Data Processing
5. Legal Basis for Processing
6. Data Retention Periods
7. Data Sharing with Third Parties
8. International Data Transfers
9. User Rights (Access, Rectification, Erasure, Portability, etc.)
10. Cookie Policy Reference

**📋 TERMS OF SERVICE PAGE (terms.html) - MANDATORY 14 SECTIONS:**
Terms of Service MUST contain EXACTLY 14 distinct sections:
1. Acceptance of Terms
2. Definitions
3. User Eligibility
4. Account Registration and Security
5. Permitted Use of Services
6. Prohibited Activities
7. Intellectual Property Rights
8. User-Generated Content
9. Third-Party Links and Services
10. Disclaimers and Limitation of Liability
11. Indemnification
12. Termination
13. Governing Law and Dispute Resolution
14. Contact Information and Notices

**🍪 COOKIE POLICY PAGE (cookie-policy.html) - MANDATORY WITH TABLE:**
Cookie Policy MUST include a table with columns: Cookie Name, Provider, Purpose, Expiry, Type.
Include AT LEAST 6-10 different cookies in the table.
- "Scroll to top" button that resets scroll on navigation
- NO pricing, costs, or monetary amounts
- Proper lang attribute matching site language
- 5-8 content sections on index.html + header/footer
- Unique page paths (not generic names)
- Humanized, natural text content (avoid AI patterns)
- Full meta data for SEO
- Use exact domain/address/phone from client

TECHNICAL REQUIREMENTS:
- Semantic HTML5, modern CSS (Flexbox/Grid), vanilla JavaScript
- Fully responsive mobile-first design
- Accessible (ARIA labels), SEO optimized
- Cross-browser compatible

INCLUDE THESE FEATURES:
- Working contact form
- Mobile navigation menu  
- Image galleries
- Call-to-action buttons
- Social media links
- Footer with sitemap

**IMAGE HANDLING - CRITICAL RULES:**
{{IMAGE_STRATEGY}}
- **Image dimensions:** 1200x800 for hero, 800x600 for content
- **Alt text MUST describe business context** (not generic)
- **Each image gets unique random parameter**

CODING STANDARDS:
- Clean, maintainable code
- Proper file organization
- Use provided image URLs for best quality

FORMAT:
<!-- FILE: filename -->
[complete file content]

Return ALL files with FULL, WORKING code.`;

interface GeneratedFile {
  path: string;
  content: string;
}

// ============================================================================
// PEXELS IMAGE FETCHING
// ============================================================================
const IMAGE_STRATEGY_BASIC = `
- **USE ONLY generic placeholder services:**
  - https://picsum.photos/1200/800?random=1 (change number for each image)
  - https://placehold.co/1200x800/EFEFEF/AAA?text=Image+Description
`;

async function fetchPexelsPhotos(query: string, count: number = 15): Promise<string[]> {
  const pexelsKey = Deno.env.get("PEXELS_API_KEY");
  if (!pexelsKey) {
    console.log("PEXELS_API_KEY not configured, falling back to picsum");
    return [];
  }

  try {
    const response = await fetch(
      `https://api.pexels.com/v1/search?query=${encodeURIComponent(query)}&per_page=${count}&orientation=landscape`,
      { headers: { Authorization: pexelsKey } }
    );

    if (!response.ok) {
      console.log(`Pexels API error: ${response.status}`);
      return [];
    }

    const data = await response.json();
    const urls = (data.photos || []).map((p: any) => p.src?.large2x || p.src?.large || p.src?.original);
    console.log(`📸 Fetched ${urls.length} photos from Pexels for "${query}"`);
    return urls.filter(Boolean);
  } catch (err) {
    console.log("Pexels fetch error:", err);
    return [];
  }
}

function buildPexelsImageStrategy(pexelsUrls: string[]): string {
  if (pexelsUrls.length === 0) {
    return IMAGE_STRATEGY_BASIC;
  }

  return `
**HIGH-QUALITY STOCK PHOTOS - USE THESE EXACT URLs:**
${pexelsUrls.map((url, i) => `${i + 1}. ${url}`).join("\n")}

**USAGE RULES:**
- Use these URLs directly in <img src="..."> tags
- Distribute across all pages (hero, about, services, etc.)
- Each image can be used once or twice maximum
- Add descriptive alt text for each image
- All images are already optimized and high-quality
`;
}

async function extractKeywords(prompt: string, apiKey: string): Promise<string> {
  try {
    const response = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "google/gemini-2.5-flash",
        messages: [
          {
            role: "user",
            content: `Extract 2-4 keywords for stock photo search from this website description. Return ONLY keywords separated by spaces, nothing else:\n\n"${prompt.substring(0, 500)}"`,
          },
        ],
        max_tokens: 50,
      }),
    });

    if (!response.ok) return extractKeywordsFallback(prompt);
    
    const data = await response.json();
    const keywords = data.choices?.[0]?.message?.content?.trim() || "";
    console.log(`🔍 AI extracted keywords: "${keywords}"`);
    return keywords || extractKeywordsFallback(prompt);
  } catch {
    return extractKeywordsFallback(prompt);
  }
}

function extractKeywordsFallback(prompt: string): string {
  const common = ["business", "professional", "corporate", "modern", "office"];
  const words = prompt.toLowerCase().split(/\s+/).slice(0, 10);
  const keywords = words.filter(w => w.length > 4 && !["website", "create", "build", "make", "need"].includes(w));
  return keywords.slice(0, 3).join(" ") || common[Math.floor(Math.random() * common.length)];
}

// ============================================================================
// FILE PARSING - Exact n8n workflow logic
// ============================================================================
function parseFilesFromResponse(responseText: string): GeneratedFile[] {
  const files: GeneratedFile[] = [];
  const normalizedText = responseText.replace(/\r\n/g, "\n");
  const filesMap = new Map<string, string>();

  console.log("=== DEBUG: PARSING RESPONSE ===");
  console.log("Response length:", responseText.length);
  console.log("Preview (first 500 chars):", normalizedText.substring(0, 500));

  // n8n patterns - check ALL patterns simultaneously (not as fallbacks)
  const filePatterns = [
    // Pattern 1: HTML comment format <!-- FILE: ... -->
    /<!-- FILE: ([^>]+) -->([\s\S]*?)(?=<!-- FILE: |$)/g,
    
    // Pattern 2: CSS/JS comment format /* FILE: ... */
    /\/\* FILE: ([^*]+) \*\/([\s\S]*?)(?=\/\* FILE: |$)/g,
    
    // Pattern 3: Mixed format with newline termination
    /\/\* FILE: ([^*]+) \*\/\s*([\s\S]*?)(?=\n\/\* FILE: |\n```|$)/g
  ];

  let matchFound = false;

  for (const pattern of filePatterns) {
    pattern.lastIndex = 0; // Reset search position
    let match;
    
    while ((match = pattern.exec(normalizedText)) !== null) {
      const fileName = match[1].trim();
      let fileContent = match[2].trim();
      
      console.log(`🔍 Pattern match: ${fileName}`);
      
      // Clean content from markdown artifacts (exact n8n logic)
      fileContent = fileContent
        .replace(/^```[a-z]*\n/, '')  // Remove code block start
        .replace(/\n```$/, '')         // Remove code block end
        .replace(/^`{3,}/, '')         // Remove any ` at start
        .replace(/`{3,}$/, '');        // Remove any ` at end
      
      // Check if content contains next file marker
      const nextFileMarker = fileContent.match(/<!-- FILE: |\/\* FILE: /);
      if (nextFileMarker && nextFileMarker.index !== undefined) {
        fileContent = fileContent.substring(0, nextFileMarker.index).trim();
      }
      
      if (fileContent && fileContent.length > 10) {
        // Determine file extension if not present
        let finalFileName = fileName;
        if (!fileName.includes('.')) {
          if (fileContent.includes('<!DOCTYPE') || fileContent.includes('<html')) {
            finalFileName = fileName + '.html';
          } else if (fileContent.includes(':root') || fileContent.includes('{') && fileContent.includes('}')) {
            finalFileName = fileName + '.css';
          } else {
            finalFileName = fileName + '.txt';
          }
        }
        
        filesMap.set(finalFileName, fileContent);
        console.log(`✅ Found file: ${finalFileName} (${fileContent.length} chars)`);
        matchFound = true;
      }
    }
  }

  // Alternative parsing for very clean output (n8n fallback logic)
  if (!matchFound) {
    console.log("🔍 Trying alternative parsing...");
    
    // Split by explicit file markers
    const fileSections = normalizedText.split(/(?:\/\* FILE: |<!-- FILE: )/);
    
    if (fileSections.length > 1) {
      for (let i = 1; i < fileSections.length; i++) {
        const section = fileSections[i].trim();
        const firstLineEnd = section.indexOf('\n');
        
        if (firstLineEnd > 0) {
          const fileName = section.substring(0, firstLineEnd)
            .replace(/\*\/$/, '')
            .replace(/-->$/, '')
            .trim();
          let fileContent = section.substring(firstLineEnd + 1).trim();
          
          // Trim to next marker
          const nextMarker = fileContent.match(/(?:\/\* FILE: |<!-- FILE: )/);
          if (nextMarker && nextMarker.index !== undefined) {
            fileContent = fileContent.substring(0, nextMarker.index).trim();
          }
          
          if (fileName && fileContent && fileContent.length > 10) {
            filesMap.set(fileName, fileContent);
            console.log(`✅ Alt found: ${fileName} (${fileContent.length} chars)`);
          }
        }
      }
    }
  }

  // Gemini/code block fallback patterns
  if (filesMap.size === 0) {
    console.log("🔍 Trying code block patterns...");
    
    // Pattern: **filename.ext** followed by code block
    const geminiPattern = /\*\*([a-zA-Z0-9_\-\/\.]+\.(?:html|css|js|xml|txt|json))\*\*\s*\n```[a-z]*\n([\s\S]*?)```/gi;
    let match;
    
    while ((match = geminiPattern.exec(normalizedText)) !== null) {
      filesMap.set(match[1], match[2].trim());
      console.log(`✅ Gemini format: ${match[1]} (${match[2].length} chars)`);
    }
  }

  // Remove duplicates and return
  console.log(`📁 Total unique files found: ${filesMap.size}`);
  
  if (filesMap.size === 0) {
    console.log("❌ No files parsed from response");
    console.log("Response preview for debugging:", normalizedText.substring(0, 1000));
  }

  return Array.from(filesMap.entries()).map(([path, content]) => ({ path, content }));
}

async function createZipBase64(files: GeneratedFile[]): Promise<string> {
  const blobWriter = new zip.BlobWriter("application/zip");
  const zipWriter = new zip.ZipWriter(blobWriter);
  
  for (const file of files) {
    await zipWriter.add(file.path, new zip.TextReader(file.content));
  }
  
  const zipBlob = await zipWriter.close();
  const arrayBuffer = await zipBlob.arrayBuffer();
  const uint8Array = new Uint8Array(arrayBuffer);
  
  let binary = '';
  for (let i = 0; i < uint8Array.length; i++) {
    binary += String.fromCharCode(uint8Array[i]);
  }
  return btoa(binary);
}

// ============ POST-VALIDATION WITH AUTO-FIX ============
/**
 * Generates a realistic phone number based on geo
 */
function generateRealisticPhone(geo?: string): string {
  const geoLower = (geo || '').toLowerCase();
  
  const phoneFormats: Record<string, () => string> = {
    'ua': () => `+380 ${Math.floor(Math.random() * 90) + 10} ${Math.floor(Math.random() * 900) + 100} ${Math.floor(Math.random() * 90) + 10} ${Math.floor(Math.random() * 90) + 10}`,
    'ukraine': () => `+380 ${Math.floor(Math.random() * 90) + 10} ${Math.floor(Math.random() * 900) + 100} ${Math.floor(Math.random() * 90) + 10} ${Math.floor(Math.random() * 90) + 10}`,
    'ru': () => `+7 ${Math.floor(Math.random() * 900) + 100} ${Math.floor(Math.random() * 900) + 100}-${Math.floor(Math.random() * 90) + 10}-${Math.floor(Math.random() * 90) + 10}`,
    'russia': () => `+7 ${Math.floor(Math.random() * 900) + 100} ${Math.floor(Math.random() * 900) + 100}-${Math.floor(Math.random() * 90) + 10}-${Math.floor(Math.random() * 90) + 10}`,
    'us': () => `+1 (${Math.floor(Math.random() * 900) + 100}) ${Math.floor(Math.random() * 900) + 100}-${Math.floor(Math.random() * 9000) + 1000}`,
    'usa': () => `+1 (${Math.floor(Math.random() * 900) + 100}) ${Math.floor(Math.random() * 900) + 100}-${Math.floor(Math.random() * 9000) + 1000}`,
    'de': () => `+49 ${Math.floor(Math.random() * 900) + 100} ${Math.floor(Math.random() * 9000000) + 1000000}`,
    'germany': () => `+49 ${Math.floor(Math.random() * 900) + 100} ${Math.floor(Math.random() * 9000000) + 1000000}`,
    'pt': () => `+351 ${Math.floor(Math.random() * 900) + 100} ${Math.floor(Math.random() * 900) + 100} ${Math.floor(Math.random() * 900) + 100}`,
    'portugal': () => `+351 ${Math.floor(Math.random() * 900) + 100} ${Math.floor(Math.random() * 900) + 100} ${Math.floor(Math.random() * 900) + 100}`,
    'es': () => `+34 ${Math.floor(Math.random() * 900) + 100} ${Math.floor(Math.random() * 900) + 100} ${Math.floor(Math.random() * 900) + 100}`,
    'spain': () => `+34 ${Math.floor(Math.random() * 900) + 100} ${Math.floor(Math.random() * 900) + 100} ${Math.floor(Math.random() * 900) + 100}`,
    'fr': () => `+33 ${Math.floor(Math.random() * 9) + 1} ${Math.floor(Math.random() * 90) + 10} ${Math.floor(Math.random() * 90) + 10} ${Math.floor(Math.random() * 90) + 10} ${Math.floor(Math.random() * 90) + 10}`,
    'france': () => `+33 ${Math.floor(Math.random() * 9) + 1} ${Math.floor(Math.random() * 90) + 10} ${Math.floor(Math.random() * 90) + 10} ${Math.floor(Math.random() * 90) + 10} ${Math.floor(Math.random() * 90) + 10}`,
    'uk': () => `+44 ${Math.floor(Math.random() * 9000) + 1000} ${Math.floor(Math.random() * 900000) + 100000}`,
    'gb': () => `+44 ${Math.floor(Math.random() * 9000) + 1000} ${Math.floor(Math.random() * 900000) + 100000}`,
    'pl': () => `+48 ${Math.floor(Math.random() * 900) + 100} ${Math.floor(Math.random() * 900) + 100} ${Math.floor(Math.random() * 900) + 100}`,
    'poland': () => `+48 ${Math.floor(Math.random() * 900) + 100} ${Math.floor(Math.random() * 900) + 100} ${Math.floor(Math.random() * 900) + 100}`,
    'ro': () => `+40 ${Math.floor(Math.random() * 900) + 100} ${Math.floor(Math.random() * 900) + 100} ${Math.floor(Math.random() * 900) + 100}`,
    'romania': () => `+40 ${Math.floor(Math.random() * 900) + 100} ${Math.floor(Math.random() * 900) + 100} ${Math.floor(Math.random() * 900) + 100}`,
    'it': () => `+39 ${Math.floor(Math.random() * 900) + 100} ${Math.floor(Math.random() * 900) + 100} ${Math.floor(Math.random() * 9000) + 1000}`,
    'italy': () => `+39 ${Math.floor(Math.random() * 900) + 100} ${Math.floor(Math.random() * 900) + 100} ${Math.floor(Math.random() * 9000) + 1000}`,
  };
  
  for (const [key, generator] of Object.entries(phoneFormats)) {
    if (geoLower.includes(key)) {
      return generator();
    }
  }
  
  // Default US format
  return `+1 (${Math.floor(Math.random() * 900) + 100}) ${Math.floor(Math.random() * 900) + 100}-${Math.floor(Math.random() * 9000) + 1000}`;
}

/**
 * Extracts phone number from prompt
 */
function extractPhoneFromPrompt(prompt: string): string | undefined {
  const patterns = [
    /(?:phone|tel|телефон|номер)[:\s]*([+\d\s().-]{10,20})/i,
    /(\+\d{1,3}[\s.-]?\(?\d{2,4}\)?[\s.-]?\d{2,4}[\s.-]?\d{2,4}[\s.-]?\d{0,4})/,
  ];
  
  for (const pattern of patterns) {
    const match = prompt.match(pattern);
    if (match && match[1]) {
      return match[1].trim();
    }
  }
  return undefined;
}

/**
 * Post-validation: ensures contact.html has phone/email and all pages have contact links in footer
 */
function postValidateAndFixFiles(
  files: GeneratedFile[],
  phone: string,
  email?: string,
  siteName?: string
): { files: GeneratedFile[]; fixes: string[] } {
  const fixes: string[] = [];
  const resultFiles = [...files];
  
  // Find contact.html
  const contactIndex = resultFiles.findIndex(f => /contact\.html?$/i.test(f.path));
  
  // Fix 1: Ensure contact.html has phone and email
  if (contactIndex >= 0) {
    let contactContent = resultFiles[contactIndex].content;
    const hasPhone = contactContent.includes(phone) || /tel:[+\d\s()-]+/i.test(contactContent);
    const hasEmail = email ? contactContent.includes(email) : /@[\w.-]+\.\w+/.test(contactContent);
    
    if (!hasPhone) {
      const phoneHtml = `<div class="contact-phone" style="margin:20px 0;font-size:1.2em;"><a href="tel:${phone.replace(/\s/g, '')}" style="color:inherit;text-decoration:none;">${phone}</a></div>`;
      
      if (/<\/main>/i.test(contactContent)) {
        contactContent = contactContent.replace(/<\/main>/i, `${phoneHtml}\n</main>`);
      } else if (/<\/body>/i.test(contactContent)) {
        contactContent = contactContent.replace(/<\/body>/i, `${phoneHtml}\n</body>`);
      }
      resultFiles[contactIndex] = { ...resultFiles[contactIndex], content: contactContent };
      fixes.push(`Added phone ${phone} to contact.html`);
    }
    
    if (!hasEmail && email) {
      const emailHtml = `<div class="contact-email" style="margin:20px 0;font-size:1.2em;"><a href="mailto:${email}" style="color:inherit;text-decoration:none;">${email}</a></div>`;
      contactContent = resultFiles[contactIndex].content;
      if (/<\/main>/i.test(contactContent)) {
        contactContent = contactContent.replace(/<\/main>/i, `${emailHtml}\n</main>`);
      } else if (/<\/body>/i.test(contactContent)) {
        contactContent = contactContent.replace(/<\/body>/i, `${emailHtml}\n</body>`);
      }
      resultFiles[contactIndex] = { ...resultFiles[contactIndex], content: contactContent };
      fixes.push(`Added email ${email} to contact.html`);
    }
  }
  
  // Fix 2: Ensure all HTML pages have contact link and phone in footer
  resultFiles.forEach((file, index) => {
    if (!/\.(html?|php)$/i.test(file.path)) return;
    
    let content = file.content;
    let modified = false;
    
    const hasFooter = /<footer/i.test(content);
    
    if (hasFooter) {
      const footerMatch = content.match(/<footer[^>]*>([\s\S]*?)<\/footer>/i);
      if (footerMatch) {
        const footerContent = footerMatch[1];
        const hasContactLink = /href=["']\.?\/?contact\.html?["']/i.test(footerContent) || 
                               /href=["']#contact["']/i.test(footerContent) ||
                               />contact</i.test(footerContent.toLowerCase());
        const hasPhoneInFooter = footerContent.includes(phone) || /tel:[+\d\s()-]+/i.test(footerContent);
        
        if (!hasContactLink) {
          const contactLink = `<a href="contact.html" style="color:inherit;text-decoration:underline;">Contact</a>`;
          content = content.replace(/<\/footer>/i, `<div class="footer-contact-section" style="margin-top:10px;">${contactLink}</div>\n</footer>`);
          modified = true;
          fixes.push(`Added contact link to footer in ${file.path}`);
        }
        
        if (!hasPhoneInFooter) {
          const phoneLink = `<a href="tel:${phone.replace(/\s/g, '')}" style="color:inherit;">${phone}</a>`;
          content = content.replace(/<\/footer>/i, `<div class="footer-phone-section" style="margin-top:10px;">${phoneLink}</div>\n</footer>`);
          modified = true;
          fixes.push(`Added phone ${phone} to footer in ${file.path}`);
        }
      }
    } else {
      // No footer - add a minimal one before </body>
      const minimalFooter = `
<footer class="site-footer" style="background:#222;color:#fff;padding:40px 20px;margin-top:auto;">
  <div class="footer-container" style="max-width:1200px;margin:0 auto;text-align:center;">
    <p><a href="contact.html" style="color:#fff;text-decoration:underline;">Contact Us</a></p>
    <p><a href="tel:${phone.replace(/\s/g, '')}" style="color:#fff;">${phone}</a></p>
    <p>&copy; ${new Date().getFullYear()} ${siteName || 'Company'}. All rights reserved.</p>
  </div>
</footer>`;
      
      if (/<\/body>/i.test(content)) {
        content = content.replace(/<\/body>/i, `${minimalFooter}\n</body>`);
        modified = true;
        fixes.push(`Added missing footer with contact link and phone to ${file.path}`);
      }
    }
    
    if (modified) {
      resultFiles[index] = { ...file, content };
    }
  });
  
  console.log(`📋 Post-validation fixes applied: ${fixes.length}`);
  fixes.forEach(fix => console.log(`  ✓ ${fix}`));
  
  return { files: resultFiles, fixes };
}
// ============ END POST-VALIDATION ============

// ============================================================================
// MAIN GENERATION FUNCTION
// ============================================================================
async function runLovableCodexGeneration(
  prompt: string,
  language: string,
  siteName: string,
  historyId: string,
  supabaseUrl: string,
  supabaseKey: string,
  geo?: string
) {
  const supabase = createClient(supabaseUrl, supabaseKey);
  const lovableApiKey = Deno.env.get("LOVABLE_API_KEY") ?? "";

  if (!lovableApiKey) {
    throw new Error("LOVABLE_API_KEY is not configured");
  }
  
  console.log(`🚀 Starting Lovable Codex generation for: ${siteName}`);
  console.log(`📝 Language: ${language}, GEO: ${geo || 'not specified'}`);
  
  // Update status to generating
  await (supabase as any)
    .from("generation_history")
    .update({ status: "generating" })
    .eq("id", historyId);
  
  try {
    const TIMEOUT_MS = 10 * 60 * 1000; // 10 minutes timeout
    
    // Step 1: Refine the prompt using AI Agent logic
    console.log("📝 Step 1: Refining prompt...");
    
    const refineController = new AbortController();
    const refineTimeoutId = setTimeout(() => refineController.abort(), TIMEOUT_MS);
    
    let refinedPrompt = prompt;
    
    try {
      const refineResponse = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${lovableApiKey}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          model: "google/gemini-2.5-flash",
          messages: [
            { role: "system", content: PROMPT_REFINER_SYSTEM },
            { role: "user", content: `Создай ОДИН промт для генерации статического HTML/CSS/JS сайта на основе этого запроса:\n\n"${prompt}"${geo ? `\n\nGEO: ${geo}` : ''}${language ? `\nLanguage: ${language}` : ''}` },
          ],
          stream: false,
          max_tokens: 4000,
        }),
        signal: refineController.signal,
      });
      
      if (refineResponse.ok) {
        const refineData = await refineResponse.json();
        const refined = refineData.choices?.[0]?.message?.content;
        if (refined && refined.length > 100) {
          refinedPrompt = refined;
          console.log(`✅ Prompt refined successfully (${refined.length} chars)`);
        }
      }
    } catch (refineErr) {
      console.log("⚠️ Prompt refinement failed, using original prompt");
    } finally {
      clearTimeout(refineTimeoutId);
    }
    
    // Step 1.5: Fetch Pexels photos
    console.log("📸 Step 1.5: Fetching Pexels photos...");
    const keywords = await extractKeywords(prompt, lovableApiKey);
    console.log(`📸 Fetching Pexels photos for keywords: "${keywords}"`);
    const pexelsUrls = await fetchPexelsPhotos(keywords, 15);
    const imageStrategy = buildPexelsImageStrategy(pexelsUrls);
    
    // Step 2: Generate the website
    console.log("🏗️ Step 2: Generating website...");
    
    const generationPromptWithImages = GENERATION_PROMPT.replace("{{IMAGE_STRATEGY}}", imageStrategy);
    const fullPrompt = refinedPrompt + "\n\n" + generationPromptWithImages;
    
    const genController = new AbortController();
    const genTimeoutId = setTimeout(() => {
      console.log(`⏰ Generation timeout after ${TIMEOUT_MS / 60000} minutes`);
      genController.abort();
    }, TIMEOUT_MS);
    
    let responseText = "";
    let usedModel = "";
    
    // Use gemini-2.5-pro for better quality (like the workflow uses gpt-5-codex)
    const model = "google/gemini-2.5-pro";
    
    try {
      const response = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${lovableApiKey}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          model: model,
          messages: [
            { role: "user", content: fullPrompt },
          ],
          stream: false,
        }),
        signal: genController.signal,
      });
      
      console.log(`📥 Lovable AI responded with status:`, response.status);
      
      if (!response.ok) {
        const errorText = await response.text();
        
        if (response.status === 429) {
          throw new Error("Rate limit exceeded. Please try again later.");
        }
        if (response.status === 402) {
          throw new Error("Payment required. Please add credits to your workspace.");
        }
        
        throw new Error(`AI gateway error: ${response.status} ${errorText}`);
      }
      
      const data = await response.json();
      responseText = data.choices?.[0]?.message?.content || "";
      usedModel = model;
      
      console.log(`✅ Got response from ${model}, length: ${responseText.length} chars`);
      
    } finally {
      clearTimeout(genTimeoutId);
    }
    
    if (!responseText || responseText.length < 100) {
      throw new Error("AI returned empty or too short response");
    }
    
    // Parse files from response
    console.log("📦 Parsing files from response...");
    let files = parseFilesFromResponse(responseText);
    
    if (files.length === 0) {
      console.error("No files parsed. Response preview:", responseText.substring(0, 1000));
      throw new Error("No files parsed from AI response");
    }
    
    console.log(`📁 Parsed ${files.length} files: ${files.map(f => f.path).join(', ')}`);
    
    // POST-VALIDATION: Ensure contact.html has phone/email and all pages have contact links in footer
    const phoneFromPrompt = extractPhoneFromPrompt(prompt);
    const phoneToUse = phoneFromPrompt || generateRealisticPhone(geo);
    const emailMatch = prompt.match(/(?:email|e-mail|пошта|почта)[:\s]*([^\s,;\n]+@[^\s,;\n]+)/i);
    const extractedEmail = emailMatch ? emailMatch[1].trim() : undefined;
    
    console.log(`📋 Post-validation: phone="${phoneToUse}", email="${extractedEmail || 'none'}"`);
    const { files: validatedFiles, fixes } = postValidateAndFixFiles(files, phoneToUse, extractedEmail, siteName);
    files = validatedFiles;
    console.log(`📋 Post-validation completed with ${fixes.length} fixes`);
    
    // Create ZIP
    console.log("📦 Creating ZIP archive...");
    const zipBase64 = await createZipBase64(files);
    
    // Update generation_history with results
    const { error: updateError } = await (supabase as any)
      .from("generation_history")
      .update({
        status: "completed",
        files_data: files,
        zip_data: zipBase64,
        generation_cost: 1, // Fixed cost for Lovable AI
        error_message: null,
        specific_ai_model: `lovable-codex-${usedModel}`,
        completed_at: new Date().toISOString()
      })
      .eq("id", historyId);
    
    if (updateError) {
      console.error("Failed to update generation_history:", updateError);
      throw updateError;
    }
    
    console.log(`✅ Lovable Codex generation completed: ${files.length} files, model: ${usedModel}, ${fixes.length} post-fixes`);
    
    // Send notification
    const { data: historyData } = await (supabase as any)
      .from("generation_history")
      .select("user_id, site_name")
      .eq("id", historyId)
      .single();
    
    if (historyData?.user_id) {
      await (supabase as any).from("notifications").insert({
        user_id: historyData.user_id,
        title: "Генерація завершена",
        message: `Сайт "${historyData.site_name || siteName}" успішно згенеровано через Lovable Codex (${files.length} файлів)`,
        type: "generation_complete",
        data: { historyId, filesCount: files.length }
      });
    }
    
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : "Unknown error";
    console.error("❌ Lovable Codex generation failed:", errorMessage);
    
    // Update with error
    await (supabase as any)
      .from("generation_history")
      .update({
        status: "failed",
        error_message: errorMessage
      })
      .eq("id", historyId);
    
    // Refund balance
    const { data: historyData } = await (supabase as any)
      .from("generation_history")
      .select("user_id, sale_price, site_name")
      .eq("id", historyId)
      .single();
    
    if (historyData?.user_id && historyData?.sale_price) {
      const { data: teamMember } = await (supabase as any)
        .from("team_members")
        .select("team_id")
        .eq("user_id", historyData.user_id)
        .eq("status", "approved")
        .single();
      
      if (teamMember?.team_id) {
        const { data: team } = await (supabase as any)
          .from("teams")
          .select("balance")
          .eq("id", teamMember.team_id)
          .single();
        
        if (team) {
          await (supabase as any)
            .from("teams")
            .update({ balance: team.balance + historyData.sale_price })
            .eq("id", teamMember.team_id);
          
          await (supabase as any)
            .from("generation_history")
            .update({ sale_price: 0 })
            .eq("id", historyId);
        }
      }
      
      // Send error notification
      await (supabase as any).from("notifications").insert({
        user_id: historyData.user_id,
        title: "Помилка генерації",
        message: `Не вдалося згенерувати сайт "${historyData.site_name}": ${errorMessage}`,
        type: "generation_error",
        data: { historyId, error: errorMessage }
      });
    }
    
    throw error;
  }
}

// ============================================================================
// HTTP HANDLER
// ============================================================================
serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { historyId } = await req.json();
    
    if (!historyId) {
      return new Response(
        JSON.stringify({ error: "historyId is required" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }
    
    const supabaseUrl = Deno.env.get("SUPABASE_URL") ?? "";
    const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "";
    const authHeader = req.headers.get("Authorization") ?? "";
    
    // Get generation details
    const supabase = createClient(supabaseUrl, supabaseKey);
    
    const { data: history, error: historyError } = await (supabase as any)
      .from("generation_history")
      .select("*")
      .eq("id", historyId)
      .single();
    
    if (historyError || !history) {
      return new Response(
        JSON.stringify({ error: "Generation not found" }),
        { status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }
    
    console.log(`📋 Starting Lovable Codex for: ${history.site_name || 'Unknown'}`);
    
    // Run generation in background
    EdgeRuntime.waitUntil(
      runLovableCodexGeneration(
        history.prompt,
        history.language,
        history.site_name || "Website",
        historyId,
        supabaseUrl,
        supabaseKey,
        history.geo
      )
    );
    
    return new Response(
      JSON.stringify({ 
        success: true, 
        message: "Lovable Codex generation started",
        historyId 
      }),
      { status: 202, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
    
  } catch (error) {
    console.error("Request error:", error);
    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : "Unknown error" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
