# مشکل سوم: لود نشدن کلاس‌های Filter در زمان اجرا (ClassNotFoundException)

## شرح مشکل
بعد از ارتقای افزونه و تغییرات Spring Scanner، افزونه به درستی بیلد می‌شد اما پس از آپلود در جیرا نسخه 11، پیغام خطای `0 of 6 modules enabled` نمایش داده می‌شد. با بررسی لاگ سرور تام‌کتِ جیرا متوجه ارور زیر شدیم:
`java.lang.NoClassDefFoundError: jakarta/servlet/Filter`
و همچنین
`ClassNotFoundException: jakarta.servlet.Filter not found by ir.atlassian.jira.plugins.persian-calendar-plugin`

## تحلیل و علت‌یابی (Root Cause Analysis)
این مشکل پیچیده‌ترین بخش از فرآیند ارتقا به Jira 11 بود و دارای چند لایه علت بود:

### ۱. مشکل تبدیل بایت‌کد (Bytecode Transformation):
ما می‌خواستیم سورس‌کد افزونه با `javax` باقی بماند تا با نسخه‌های ۸ و ۹ هم سازگار باشد، و از یک پلاگین مِیون (Transformer) استفاده کردیم تا در زمان بیلد، کلمات `javax` را به `jakarta` تبدیل کند. در ابتدا از `eclipse-transformer-maven-plugin` استفاده شد اما این ابزار متوجه نمی‌شد که پکیجِ ما از نوعِ `atlassian-plugin` است و فایل‌های `.class` را دور می‌زد و هیچ تغییری اعمال نمی‌کرد. بنابراین جیرا به جای `jakarta.servlet` همچنان کدهای `javax.servlet` را اجرا می‌کرد.
**راه‌حل اولیه**: این پلاگین با ابزار `maven-shade-plugin` جایگزین شد که به صورت مستقیم روی بایت‌کدها Relocation انجام می‌دهد و بسیار پایدارتر است. تمام `javax.*` ها در کلاس‌های نهایی به `jakarta.*` تغییر داده شدند.

### ۲. مشکل OSGi در مانیفست افزونه (`MANIFEST.MF`):
پس از حل مشکل بایت‌کد و ایجاد کلاس‌های جاکارتا، لاگِ جیرا همچنان خطای `ClassNotFoundException: jakarta.servlet.Filter` می‌داد. 
دلیل این موضوع این بود که کلاس‌لودرِ OSGi (فریم‌ورک ماژولار جیرا که Felix نام دارد) برای لود کردن کلاس‌های خارج از افزونه، حتماً نیازمند این است که پکیج آن کلاس در بخش `Import-Package` یا `DynamicImport-Package` مانیفست تعریف شده باشد.
زمانی که `maven-bundle-plugin` (که توسط `jira-maven-plugin` اجرا می‌شود) می‌خواست مانیفست را بسازد، به سورس کدهای اولیه و `target/classes` قبل از Shade نگاه می‌کرد که با کلمه `javax` بودند. بنابراین، فقط پکیج‌های `javax` را در لیست وارد می‌کرد و پکیج‌های `jakarta` در `Import-Package` کاملاً غایب بودند!

ابتدا تلاش شد از طریق دستور `<DynamicImport-Package>jakarta.*</DynamicImport-Package>` به OSGi اجازه بدهیم خودش پکیج‌ها را جستجو کند. اما گاهی OSGi در لود کردنِ پکیج‌های پایه‌ای سیستم (مثل servlet) از طریق Dynamic Import محتاطانه عمل می‌کند و با خطای strict-mode مواجه می‌شود.

## راه‌حل نهایی
بهترین، امن‌ترین و قطعی‌ترین راه‌حل این بود که به `maven-bundle-plugin` دستور بدهیم به صورت Explicit (صریح) پکیج‌های `jakarta` را در فایل `MANIFEST.MF` درج کند تا کلاس‌لودر جیرا مجبور شود از همان ابتدا در زمان نصب افزونه (Activation Phase) این پکیج‌ها را از سیستم مرکزی جیرا به افزونه Import کند.

در فایل `pom.xml` پیکربندی زیر اضافه شد:

```xml
<Import-Package>
    com.atlassian.plugins.rest.common.security;resolution:=optional,
    com.atlassian.plugins.rest.api.security;resolution:=optional,
    javax.servlet*;resolution:=optional,
    javax.ws.rs*;resolution:=optional,
    javax.inject*;resolution:=optional,
    javax.annotation*;resolution:=optional,
    jakarta.servlet;resolution:=optional,
    jakarta.servlet.http;resolution:=optional,
    jakarta.ws.rs;resolution:=optional,
    jakarta.ws.rs.core;resolution:=optional,
    jakarta.inject;resolution:=optional,
    jakarta.annotation;resolution:=optional,
    *
</Import-Package>
```

با این تغییر، پکیج‌های حیاتی `jakarta` وارد مانیفست شدند و با موفقیت کلاس `jakarta.servlet.Filter` برای افزونه شناخته شد و هر 6 ماژول به درستی لود و فعال شدند.
