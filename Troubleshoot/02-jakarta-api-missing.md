# مشکل دوم: خطای کامپایل به خاطر کمبود کتابخانه‌های Jakarta

## شرح مشکل
در طی آماده‌سازی افزونه برای Jira 10 و Jira 11، به هنگام بیلد کد (پکیج شدن)، کامپایلر خطاهای مختلفی مربوط به نبودِ کلاس‌ها (مانند `javax.inject.Inject` و پکیج‌های Servlet) گزارش می‌داد.

## تحلیل و علت‌یابی (Root Cause Analysis)
از نسخه Jira 10 به بعد، شرکت اطلسین تصمیم گرفت که به طور کامل از استکِ `javax` به `jakarta` مهاجرت کند (به دلیل تغییرات حقوقی در اکوسیستم جاوا و انتقال Java EE به بنیاد Eclipse که نام آن به Jakarta EE تغییر کرد). به همین دلیل:
1. پکیج‌های `javax.inject` به `jakarta.inject` منتقل شده‌اند.
2. پکیج‌های مربوط به وب و کانتینر Tomcat نیز از `javax.servlet` به `jakarta.servlet` تغییر نام داده‌اند.
3. پکیج‌های JAX-RS (برای نوشتن APIهای REST) از `javax.ws.rs` به `jakarta.ws.rs` منتقل شده‌اند.

وقتی ما نسخه Jira API را در وابستگی‌های پُم ارتقا دادیم، جیرا به جای `javax` از پکیج‌های `jakarta` استفاده می‌کرد و چون افزونه ما از `javax` استفاده می‌کرد، کامپایلر نمی‌توانست کلاس‌های واسط را پیدا کند.

## راه‌حل
کتابخانه‌های `jakarta` به عنوان وابستگی (Dependency) با scope از نوع `provided` به فایل `pom.xml` اضافه شدند. با این کار کامپایلر جاوا متوجه مسیرها می‌شود، اما خود کتابخانه‌ها وارد JAR نهایی نمی‌شوند (چون خودِ جیرا در زمان اجرا آن‌ها را تامین می‌کند).

```xml
<!-- Jakarta Dependencies for Jira 10/11 compatibility -->
<dependency>
    <groupId>jakarta.inject</groupId>
    <artifactId>jakarta.inject-api</artifactId>
    <version>2.0.1</version>
    <scope>provided</scope>
</dependency>
<dependency>
    <groupId>jakarta.servlet</groupId>
    <artifactId>jakarta.servlet-api</artifactId>
    <version>5.0.0</version>
    <scope>provided</scope>
</dependency>
<dependency>
    <groupId>jakarta.ws.rs</groupId>
    <artifactId>jakarta.ws.rs-api</artifactId>
    <version>3.0.0</version>
    <scope>provided</scope>
</dependency>
<dependency>
    <groupId>jakarta.annotation</groupId>
    <artifactId>jakarta.annotation-api</artifactId>
    <version>2.1.1</version>
    <scope>provided</scope>
</dependency>
```
