# Studio — الفرونت (الصفحات)

صفحات ثابتة (HTML + CSS + JavaScript) من غير أي أدوات بناء. بتكلّم الباك اند (ريبو `studio-backend`) عن طريق عنوان واحد.

## الإعداد الوحيد المطلوب
افتح `js/config.js` وحط عنوان السيرفر (من غير `/` في الآخر):
```js
window.STUDIO_CONFIG = {
  apiBase: "https://YOUR-BACKEND.vercel.app",
};
```

## الاستضافة
الملفات كلها ثابتة، فأي استضافة ملفات ثابتة تنفع: **Cloudflare Pages** أو **Vercel** (يُنصح بيهم للشغل التجاري) أو GitHub Pages.
- GitHub Pages شروطها بتمنع تشغيل نشاط تجاري أو خدمة (SaaS) عليها، فمش الأنسب للشغل الفعلي.
- ملف `CNAME` مطلوب لـ GitHub Pages بس. لو هتستضيفوا على Cloudflare Pages أو Vercel امسحوه وضيفوا الدومين من لوحة الاستضافة.
- بعد ما الموقع يشتغل على دومينه، حطوا نفس الدومين في `STUDIO_URL` على السيرفر (الباك اند).

## الصفحات
`index.html` (الرئيسية) · `login.html` · `leader-signup.html` · `talent-login.html` · `tasks.html` · `talent-setup.html` · `recording.html` ·
`dashboard-head-leader.html` · `dashboard-leader.html` · `dashboard-qa.html` · `qa-review.html` · `publish-task.html` · `delivery.html` · `feedback.html` ·
`forgot-password.html` · `reset-password.html` · `404.html`

## الهوية (الاسم والأيقونة وصورة المعاينة)
- الاسم "Studio" مكتوب في الصفحات (الـ `<title>` والهيدر).
- الأيقونات وصورة معاينة الواتس في `assets/`، ووسوم `og:*` في `<head>` كل صفحة (الرابط المطلق `https://gigversestudio.click/...`). لو الدومين اتغيّر، غيّروه في وسوم `og:url` و`og:image`.

## اللغة
زرار AR / EN بيترجم الواجهة. القاموس في `js/studio-i18n-dict.js` (أي نص عربي جديد يتضاف له ترجمة هناك).
