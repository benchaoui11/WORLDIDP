# دليل إعداد WorldIDP — الدفع والتخزين (Supabase + Stripe + Vercel)

هذا الدليل يشرح خطوة بخطوة كيف تجعل الموقع يعمل بشكل كامل:
العميل يملأ بياناته ويرفع صوره → تُحفظ في **Supabase** → يُوجَّه إلى **Stripe** للدفع → أنت تشاهد كل الطلبات في لوحة Supabase.

كل ما تحتاج تعديله موجود في ملفين فقط:
- `stripe-links.js` — روابط الدفع
- `supabase-config.js` — رابط ومفتاح Supabase

---

## الجزء 1 — روابط Stripe (10 روابط)

عندك صيغتان (Digital / Print) × خمس مدد = 10 منتجات.

1. ادخل إلى **Stripe Dashboard → Payment Links → Create link**.
2. أنشئ رابطاً لكل منتج (مثلاً "Digital — 1 Year").
3. انسخ الرابط (يبدأ بـ `https://buy.stripe.com/...`).
4. افتح `stripe-links.js` والصق كل رابط في مكانه:

```js
"digital-1": "https://buy.stripe.com/xxxxx",   // الرقمي - سنة
"digital-2": "https://buy.stripe.com/xxxxx",   // الرقمي - سنتان
"digital-3": "https://buy.stripe.com/xxxxx",   // الرقمي - 3 سنوات
"physical-1": "https://buy.stripe.com/xxxxx",  // المطبوع - سنة
...
```

5. غيّر `live: false` إلى **`live: true`**.

> إذا تركت `live: false`، يعمل الموقع بشكل كامل لكن يعرض رسالة "test mode" بدل التحويل لـ Stripe — مفيد أثناء التجربة.

### مهم: تمرير البيانات لـ Stripe
الكود يمرّر تلقائياً لـ Stripe:
- `prefilled_email` — بريد العميل (يُملأ مسبقاً)
- `client_reference_id` — مرجع الطلب الفريد (مثل `WIDP-XXXX`)

هذا المرجع هو ما يربط الدفعة في Stripe بالطلب في Supabase. لتفعيل ظهور هذه القيم، في إعدادات Payment Link فعّل خيار **"prefill customer email"** إن وُجد.

---

## الجزء 2 — Supabase (قاعدة البيانات + تخزين الصور)

### 2.1 أنشئ مشروعاً
1. ادخل [supabase.com](https://supabase.com) → **New Project**.
2. اختر اسماً وكلمة مرور قوية للقاعدة.

### 2.2 أنشئ الجدول
من **SQL Editor**، الصق هذا الكود وشغّله:

```sql
create table public.applications (
  id            uuid primary key default gen_random_uuid(),
  created_at    timestamptz default now(),
  ref           text unique,
  status        text default 'submitted',
  format        text,
  validity_years int,
  destination_country text,
  total         numeric,
  currency      text default 'USD',
  first_name    text,
  last_name     text,
  email         text,
  phone         text,
  license_category text,
  address_line1 text,
  address_line2 text,
  state_region  text,
  city          text,
  postal_code   text,
  shipping_method text,
  vip_processing  boolean default false,
  coupon        text,
  file_selfie         text,
  file_license_front  text,
  file_license_back   text,
  file_signature      text
);

-- فعّل حماية الصفوف (إجباري)
alter table public.applications enable row level security;

-- اسمح للزوّار بإضافة طلب جديد فقط (INSERT)، بدون قراءة طلبات الآخرين
create policy "anyone can submit an order"
  on public.applications for insert
  to anon
  with check (true);
```

> **لماذا INSERT فقط؟** هكذا أي عميل يستطيع إرسال طلبه، لكن **لا أحد يستطيع قراءة** طلبات الآخرين عبر المفتاح العام. أنت وحدك تراها من لوحة التحكم.

### 2.3 أنشئ مكان تخزين الصور (Storage)
1. من القائمة الجانبية: **Storage → New bucket**.
2. الاسم: `documents` — اتركه **Private** (غير عام).
3. من **SQL Editor**، أضف سياسة الرفع:

```sql
-- اسمح للزوّار برفع الملفات إلى bucket اسمه documents
create policy "anyone can upload documents"
  on storage.objects for insert
  to anon
  with check (bucket_id = 'documents');
```

> الصور تبقى **خاصة**. لعرضها لاحقاً، أنشئ "Signed URL" من لوحة Supabase أو من كودك الخلفي.

### 2.4 انسخ المفتاحين إلى الكود
1. **Project Settings → API**.
2. انسخ:
   - **Project URL** → ضعه في `supabase-config.js` مكان `SUPABASE_URL`
   - **anon / publishable key** → ضعه مكان `SUPABASE_ANON_KEY`

```js
window.WORLDIDP_SUPABASE = {
  SUPABASE_URL:      "https://abcdxyz.supabase.co",
  SUPABASE_ANON_KEY: "eyJhbGci....(المفتاح العام الطويل)",
  TABLE:  "applications",
  BUCKET: "documents",
};
```

> ⚠️ **لا تستخدم أبداً** مفتاح `service_role` أو `secret` في هذا الملف — إنه يتجاوز الحماية. فقط المفتاح العام (anon/publishable) آمن لوضعه في كود الموقع، **بشرط تفعيل RLS** كما فعلنا أعلاه.

### 2.5 اربط طلبات Storage بالمجال (CORS)
عادةً Supabase يسمح بذلك تلقائياً. إن واجهت مشكلة، تأكد أن نطاق موقعك على Vercel مسموح في إعدادات المشروع.

---

## الجزء 3 — النشر على GitHub + Vercel

1. ارفع مجلد الموقع كاملاً إلى مستودع على **GitHub**.
2. ادخل [vercel.com](https://vercel.com) → **Add New → Project** → اختر المستودع.
3. **Framework Preset: Other** (الموقع HTML ثابت، لا يحتاج build).
4. اضغط **Deploy**.

> لا تحتاج متغيرات بيئة (Environment Variables) لأن المفتاح العام موضوع مباشرة في الكود (وهذا آمن مع RLS). إن فضّلت إخفاءه، يمكن لاحقاً نقله لمتغير بيئة، لكنه ليس ضرورياً.

---

## كيف يعمل التدفق الكامل بعد الإعداد

```
الصفحة الرئيسية → checkout (البيانات) → upload-photos (الصور + التوقيع)
        ↓
   هل الطلب رقمي (digital)؟
        ├─ نعم → ترفع الصور لـ Supabase + تُحفظ البيانات → مباشرة لـ Stripe
        └─ لا (مطبوع) → صفحة payment (العنوان + الشحن) → عند الضغط على Pay:
                         ترفع الصور لـ Supabase + تُحفظ البيانات → Stripe
        ↓
   أنت تشاهد كل الطلبات في:
   Supabase → Table Editor → applications
   والصور في: Supabase → Storage → documents → (مجلد باسم رقم الطلب)
```

---

## التحقق من أن كل شيء يعمل

1. افتح موقعك، أكمل طلباً تجريبياً بصيغة **Digital**.
2. اذهب إلى Supabase → **Table Editor → applications** — يجب أن ترى صفاً جديداً.
3. اذهب إلى **Storage → documents** — يجب أن ترى مجلداً باسم مرجع الطلب فيه الصور.
4. كرّر مع طلب **Print + Digital** للتأكد من ظهور صفحة العنوان أولاً.

---

## ملاحظات أمان مهمة

- ✅ المفتاح العام (anon) آمن في كود الموقع **طالما RLS مفعّل** على الجدول والـ Storage.
- ✅ سياستنا تسمح بالإضافة فقط — لا قراءة عامة لبيانات العملاء.
- ❌ لا تضع مفتاح `service_role` في أي ملف من ملفات الموقع.
- 🔒 الصور خاصة افتراضياً؛ تُعرض فقط عبر Signed URLs التي تنشئها أنت.

---

## استكشاف الأخطاء

| المشكلة | الحل |
|---|---|
| تظهر رسالة "Payment is in test mode" | لم تضع رابط Stripe بعد، أو `live: false`. أضف الرابط واضبط `live: true`. |
| "Something went wrong" عند الدفع | تحقق من رابط ومفتاح Supabase، وأن RLS والسياسات أُنشئت بشكل صحيح. |
| الصور لا تُرفع | تأكد أن bucket اسمه `documents` وأن سياسة الرفع (INSERT) موجودة. |
| لا أرى الطلبات | افتح Supabase → Table Editor → applications. لن تظهر في الموقع نفسه (هذا مقصود للأمان). |

بالتوفيق! 🚗💨
