# WorldIDP Control Tower — دليل التركيب (خطوة بخطوة)

هاد الدليل غادي يخليك تركّب نظام التبديل (Offer / White / Maintenance) + الـ`/admin` dashboard. خدم بالترتيب.

---

## 1) شغّل الـSQL فـ Supabase (مرة وحدة فقط)

1. دخل لـ **Supabase Dashboard** → المشروع ديالك → **SQL Editor** → **New query**.
2. افتح الملف `admin/supabase-schema.sql`، انسخ المحتوى كامل، لصقو فـ SQL Editor.
3. اضغط **Run**.

هادشi غادي يصاوب:
- `site_settings` (جدول فيه صف وحيد = الحالة الحية)
- `switch_log` (سجل كل تبديل)
- `visitors` (زوار الموقع)
- سياسات الأمان (RLS) على الجداول الثلاثة + على `applications` (الطلبات) الموجود ديجا.

---

## 2) صاوب مستخدم Admin فـ Supabase Auth

1. فـ Supabase Dashboard → **Authentication** → **Users** → **Add user**.
2. دخل الإيميل والباسوورد ديالك (اللي غادي تستعملهم باش تدخل لـ `/admin`).
3. **Auto Confirm User** خاصو يكون ✅ مفعّل (باش ما يحتاجش تأكيد إيميل).

هادا هو الحساب الوحيد اللي غيقدر يدخل لـ `/admin` ويبدّل الموقع.

---

## 3) جيب الـService Role Key (سرّي، ماشi للـانون key)

1. فـ Supabase Dashboard → **Project Settings** → **API**.
2. تحت "Project API keys"، انسخ **`service_role`** (**ماشi** الـ`anon`/`publishable` — هادو مختلفين!).
3. خليه معاك، غادي تحتاجو فالخطوة الجاية.

⚠️ **هاد المفتاح سرّي جداً** — ما تحطوش فحتى ملف فالكود. غادي يتحط غير فـ Vercel Environment Variables (السيرفر، ماشi المتصفح).

---

## 4) زيد Environment Variables فـ Vercel

فـ Vercel Dashboard → المشروع ديالك → **Settings** → **Environment Variables**، زيد هاد الـ3:

| الاسم | القيمة | مصدرها |
|---|---|---|
| `SUPABASE_URL` | نفس القيمة اللي فـ `supabase-config.js` (`SUPABASE_URL`) | Supabase → Project Settings → API |
| `SUPABASE_ANON_KEY` | نفس القيمة اللي فـ `supabase-config.js` (`SUPABASE_ANON_KEY`) | Supabase → Project Settings → API |
| `SUPABASE_SERVICE_ROLE_KEY` | الـ`service_role` key من الخطوة 3 | Supabase → Project Settings → API |

بعد ما تزيدهم، دير **Redeploy** (ولا انتظر الـdeploy الجاي).

---

## 5) دوّز الملفات على Vercel (نفس الطريقة ديال قبل)

الملفات الجداد اللي تزادو للمشروع:
```
middleware.js               ← المحرك ديال التبديل
api/switch-mode.js          ← يبدّل الحالة (محمي بـ auth)
api/track.js                ← يسجّل الزوار
analytics-beacon.js         ← قطعة صغيرة كتبعث بيانات الزيارة
admin/                      ← كل صفحة الـdashboard (login.html, index.html, dashboard.js, admin.css)
_white/                     ← ملفات White Page كاملة
vercel.json                 ← محدّث (فيه ديجا rewrite ديال /apply، زدنا معاه)
robots.txt                  ← محدّث (كيحجب /admin و /_white من Google)
```

دوّز المشروع كامل بحال العادة (Vercel كيقرا `middleware.js` و `api/` تلقائياً — بلا إعدادات إضافية).

---

## 6) جرّب

1. دخل لـ `https://worldidp.com/admin` → خاصك توصل لصفحة تسجيل الدخول.
2. سجّل بالإيميل/الباسوورد اللي صاوبتي فالخطوة 2.
3. خاصك تشوف الـdashboard: الحالة الحية = 🟢 **OFFER PAGE**.
4. اضغط **White Page** → أكّد → افتح tab جديد وزور `worldidp.com` → خاصك تشوف White Page.
5. رجع لـ `/admin`، اضغط **Offer Page** → أكّد → الموقع يرجع للحقيقي.

---

## 7) الأمان — شنو محمي وكيفاش

| الطبقة | كيفاش محمية |
|---|---|
| **مفتاح Supabase السرّي** | `SUPABASE_SERVICE_ROLE_KEY` موجود غير فـ Vercel env vars — ما كيوصلش للمتصفح أبداً. |
| **التبديل** | `/api/switch-mode` كيتحقق من session Supabase حقيقية قبل ما يبدّل أي حاجة. |
| **`/admin`** | محمي بتسجيل دخول Supabase Auth (إيميل + باسوورد). |
| **الطلبات (`applications`)** | RLS: غير المستخدم المسجّل (انت) يقدر يقرا الطلبات فالـdashboard. |
| **الزوار (`visitors`)** | الموقع العام يقدر يكتب زيارة (insert فقط)، ما يقدرش يقرا الداتا. غير انت (authenticated) تقدر تقرا. |

---

## 8) SEO — شنو محمي وكيفاش (3 طبقات)

1. **`robots.txt`**: `Disallow: /admin`, `Disallow: /_white`, `Disallow: /api/`
2. **Header ديناميكي**: منين `mode=white` أو `maintenance`، كل response كيتبعث معاه `X-Robots-Tag: noindex`.
3. **Meta tag**: كل صفحة فـ `_white/` عندها `<meta name="robots" content="noindex, nofollow">` مكتوبة فالكود.
4. **`sitemap.xml`**: فيه غير صفحات Offer Page الحقيقية — `/admin` و `/_white` ما داخلينش فيه أبداً.
5. **HTTP 503**: منين الموقع فـ White/Maintenance، كل response كيرجع بـ status **503** (مؤقت) — هادا الأسلوب اللي كتوصي بيه Google رسمياً لتغييرات مؤقتة، وما كيهبطش الترتيب ديال Offer Page إيلا استعملتيه بشكل نادر وقصير (بحال ما وصفتي: بضع دقائق).

---

## ملاحظة مهمة (تذكير)

- **بدّل نادراً وبمدة قصيرة.** النظام مصمّم للاستعمال العرضي (منين تحس بمراقب)، ماشi للتبديل اليومي المتكرر — استعمال متكرر بزاف ممكن يأثر على SEO ديال Offer Page بشكل غير مقصود.
- منين ترجع لـ Offer، تأكد أن الموقع رجع فعلاً قبل ما تسدّ الـtab.
