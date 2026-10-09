import type { Messages } from "./en";

/** Turkish — demo-grade translations. Missing keys fall back to English. */
export const tr: Partial<Messages> = {
  "common.save": "Kaydet",
  "common.cancel": "İptal",
  "common.back": "Geri",
  "common.continue": "Devam",
  "common.close": "Kapat",
  "common.edit": "Düzenle",
  "common.search": "Ara",
  "common.loading": "Yükleniyor…",
  "common.new": "Yeni",
  "common.active": "Aktif",
  "common.inactive": "Pasif",
  "common.free": "Ücretsiz",
  "common.optional": "İsteğe bağlı",

  "nav.dashboard": "Panel",
  "nav.calendar": "Takvim",
  "nav.bookings": "Rezervasyonlar",
  "nav.clients": "Müşteriler",
  "nav.services": "Hizmetler",
  "nav.packages": "Paketler",
  "nav.forms": "Formlar",
  "nav.settings": "Ayarlar",
  "nav.overview": "Genel Bakış",
  "nav.workspaces": "Çalışma Alanları",
  "nav.subscriptions": "Abonelikler",
  "nav.inquiries": "Talepler",

  "landing.nav.features": "Özellikler",
  "landing.nav.pricing": "Fiyatlandırma",
  "landing.nav.contact": "İletişim",
  "landing.nav.demo": "Demo",
  "landing.cta.login": "Giriş yap",
  "landing.cta.startTrial": "Ücretsiz başlayın",
  "landing.cta.contact": "İletişime geçin",
  "landing.cta.openDemo": "Demoyu aç",
  "landing.cta.tryDemo": "Demoyu deneyin",

  "landing.hero.eyebrow": "Bağımsız danışmanlar, koçlar ve eğitmenler için",
  "landing.hero.title": "Takvim karmaşası olmadan, ücretli rezervasyonlar.",
  "landing.hero.subtitle":
    "Slotera, bağımsız uzmanlar için hafif bir müşteri çalışma alanıdır — kartla veya banka havalesiyle ödeme alın, hazırlık formları gönderin, seansları paketler hâlinde sunun ve müşteri bağlamı ile takibi tek yerde tutun. Ağır bir CRM değil.",
  "landing.hero.badge.noCard": "Kredi kartı gerekmez",
  "landing.hero.badge.cancel": "İstediğiniz zaman iptal edin",
  "landing.hero.badge.gdpr": "UK GDPR'a duyarlı",

  "landing.logos.trustedBy":
    "Avrupa genelinde 1.200'den fazla bağımsız danışman, koç ve eğitmen tarafından tercih ediliyor.",

  "landing.how.eyebrow": "Nasıl çalışır",
  "landing.how.title":
    "Bir öğleden sonrada e-posta trafiğinden gerçek bir rezervasyon akışına geçin.",
  "landing.how.step1.title": "Hizmetlerinizi tanımlayın",
  "landing.how.step1.body":
    "Sunduğunuz hizmetleri süre, kapasite ve fiyatla ekleyin — birebir ya da grup. Seansları çok seanslı paketler halinde gruplayın ve seanstan önce bağlam gerektiğinde bilgi formları ekleyin.",
  "landing.how.step2.title": "Tek bir rezervasyon bağlantısı paylaşın",
  "landing.how.step2.body":
    "Müşteriler bir saat seçer, seans öncesi sorularınızı yanıtlar ve kartla ya da banka havalesiyle öder. Hesap gerekmez.",
  "landing.how.step3.title": "Seansı yürütün, bağlantıda kalın",
  "landing.how.step3.body":
    "Yeni rezervasyonlar panelinize düşer. Müşteriler hazırlanmak, size mesaj atmak veya değişiklik talep etmek için bir rezervasyon sayfası alır.",

  "landing.features.eyebrow": "Özellikler",
  "landing.features.title":
    "Bağımsız bir uzmanın ihtiyacı olan her şey. Fazlası değil.",
  "landing.features.bookings.title": "Ücretli rezervasyonlar",
  "landing.features.bookings.body":
    "Müşteriler rezervasyon yaparken ödemeyi alın — kartla veya manuel banka havalesiyle, seçim sizin. Net makbuzlar, tablo uğraşı yok.",
  "landing.features.forms.title": "Müşteri bilgi ve hazırlık formları",
  "landing.features.forms.body":
    "Seanstan önce ihtiyacınız olan bağlamı toplayın. Önemli soruları ödeme öncesi zorunlu ya da sonrasında isteğe bağlı yapın.",
  "landing.features.bookingPage.title": "Müşteri rezervasyon sayfası",
  "landing.features.bookingPage.body":
    "Rezervasyondan sonra müşteriler; ayrıntıları görmek, isteğe bağlı formları tamamlamak, size mesaj atmak veya yeniden planlama istemek için bir sayfa alır.",
  "landing.features.sessions.title": "Seanslar ve takvim",
  "landing.features.sessions.body":
    "Kapasiteli ve kalan kontenjanlı birebir ya da grup seansları. Takviminizdeki çakışmalar çakışma olarak işaretlenir.",
  "landing.features.languages.title": "Çok dilli rezervasyon",
  "landing.features.languages.body":
    "Müşterileriniz İngilizce, Türkçe veya Almanca rezervasyon yapabilir — tüm akış onların diline uyar.",
  "landing.features.workspace.title": "Hafif bir müşteri çalışma alanı",
  "landing.features.workspace.body":
    "Rezervasyonlar, müşteriler, paketler ve müşteri notları için sade bir yönetim — işinizi yürütmek için tasarlandı, ağır bir CRM değil.",

  "landing.demoStrip.eyebrow": "İş başında görün",
  "landing.demoStrip.title": "Gerçek bir rezervasyon akışını deneyin. Kayıt gerekmez.",

  "landing.testimonials.eyebrow": "Görüşler",
  "landing.testimonials.title":
    "Haftada bir öğleden sonralarını sessizce geri kazandırdığımız işletmeler.",
  "landing.testimonials.q1":
    "Her hafta yarım günümü planlamaya kaybediyordum. Slotera bunu pazar akşamı yapılan kısa bir kontrole indirdi.",
  "landing.testimonials.q2":
    "Rezervasyon sayfası sitemin bir parçası gibi görünüyor. Müşteriler geçişi fark bile etmiyor.",
  "landing.testimonials.q3":
    "Kapasiteli ve bekleme listeli grup atölyeleri için bir CRM gerekirdi. Artık iki tıkla hallediliyor.",

  "landing.pricing.eyebrow": "Fiyatlandırma",
  "landing.pricing.title": "İki plan. Ücretsiz başlayın, kazandıkça yükseltin.",
  "landing.pricing.perMonth": "/ay",
  "landing.pricing.cta.start": "Hemen başlayın",
  "landing.pricing.cta.talk": "Bize ulaşın",
  "landing.pricing.free.name": "Ücretsiz",
  "landing.pricing.free.blurb": "Rezervasyon almak için gereken her şey. Biz yalnızca siz kazandığınızda kazanırız.",
  "landing.pricing.free.fee": "+ kartlı ödeme başına %3",
  "landing.pricing.pro.name": "Pro",
  "landing.pricing.pro.blurb": "Aynı çalışma alanı, daha düşük kesinti; yoğun pratikler için.",
  "landing.pricing.pro.fee": "+ kartlı ödeme başına %1",
  "landing.pricing.f1": "Sınırsız hizmet, danışan ve rezervasyon",
  "landing.pricing.f2": "Hazırlık formlarıyla herkese açık rezervasyon sayfası",
  "landing.pricing.f3": "Danışan notları ve seans takibi",
  "landing.pricing.f4": "Manuel banka havalesi ödemeleri",
  "landing.pricing.note": "Ödeme başına kesinti yalnızca kartlı ödemelere uygulanır. Manuel banka havalelerinden hiçbir kesinti alınmaz.",

  "landing.faq.eyebrow": "SSS",
  "landing.faq.title": "Sık sorulan sorular.",
  "landing.faq.q1.q": "Müşterilerimin hesap açması gerekir mi?",
  "landing.faq.q1.a":
    "Hayır. Danışanlar misafir olarak rezervasyon yapar ve rezervasyonlarını görüntüleyip erteleyebilecekleri veya iptal edebilecekleri bir e-posta bağlantısı alır. Danışan listenize otomatik olarak eklenirler.",
  "landing.faq.q2.q":
    "Danışanlar nasıl ödeme yapar?",
  "landing.faq.q2.a":
    "Şu an kendi ödeme talimatlarınızı (örneğin banka havalesi) eklersiniz ve Slotera neyin ödendiğini takip eder. Online kart ödemeleri sırada.",
  "landing.faq.q3.q": "Grup dersleri veya atölyeler düzenleyebilir miyim?",
  "landing.faq.q3.a":
    "Evet. Planlı bir hizmet oluşturun, istediğiniz kapasiteyle seanslar ekleyin; danışanlar seans dolana kadar rezervasyon yapabilir. Slotera kalan yerleri gösterir.",
  "landing.faq.q4.q": "Verileriniz nerede barındırılıyor?",
  "landing.faq.q4.a":
    "AB'deki sunucularda. Slotera, Birleşik Krallık veri koruma süreçleri göz önünde bulundurularak geliştirildi.",
  "landing.faq.q5.q":
    "Danışanlar rezervasyon sayfamı nasıl bulur?",
  "landing.faq.q5.a":
    "Her çalışma alanının kendi rezervasyon bağlantısı vardır. Web sitenizde, e-posta imzanızda veya sosyal medyada paylaşın.",
  "landing.faq.q6.q": "Bir müşteri iptal ederse ne olur?",
  "landing.faq.q6.a":
    "Danışanlar belirlediğiniz son tarihe kadar (varsayılan 24 saat) kendileri iptal edebilir veya erteleyebilir. Sonrasında sizinle iletişime geçerler. İadeleri doğrudan siz yaparsınız.",

  "landing.finalCta.eyebrow": "Slotera'yı deneyin",
  "landing.finalCta.title": "Boş saat kovalamayı bırakın.",
  "landing.finalCta.body": "Rezervasyon sayfanızı 10 dakikadan kısa sürede yayına alın. Başlamak ücretsiz, kredi kartı gerekmez.",

  "footer.tagline":
    "Slotera; bağımsız danışmanlar, koçlar ve eğitmenler için hafif bir müşteri çalışma alanıdır — ücretli rezervasyonlar, hazırlık formları, paketler ve takip; ağır bir CRM olmadan.",
  "footer.col.product": "Ürün",
  "footer.col.company": "Şirket",
  "footer.col.legal": "Yasal",
  "footer.link.demo": "Demo",
  "footer.copyright": "© Merulio Ltd. Slotera, Merulio'nun bir ürünüdür.",
  "footer.gdpr": "UK GDPR'a duyarlı",

  "legal.tab.privacy": "Gizlilik",
  "legal.tab.terms": "Koşullar",
  "legal.tab.dpa": "Veri işleme",
  "booking.legal.platformIntro": "Bu rezervasyon sayfası sağlayıcı adına Slotera tarafından işletilir. Slotera'nın verilerinizi nasıl işlediği burada açıklanır:",

  "contact.eyebrow": "İletişim",
  "contact.title": "Bize ulaşın",
  "contact.description":
    "İş talepleri, geliştirme sorunları, özellik istekleri — bize yazın, en kısa sürede dönelim.",
  "contact.send": "Mesaj gönder",
  "contact.field.name": "Ad",
  "contact.field.email": "E-posta",
  "contact.field.reason": "Konu",
  "contact.field.message": "Mesaj",
  "contact.reason.business": "İş talebi",
  "contact.reason.development": "Geliştirme sorunu",
  "contact.reason.feature": "Özellik isteği",
  "contact.reason.general": "Genel talep",
  "contact.message.placeholder": "Aklınızdakini bizimle paylaşın…",
  "contact.success.title": "Mesaj gönderildi.",
  "contact.success.body":
    "Bize ulaştığınız için teşekkürler — bir ekip arkadaşımız bir iş günü içinde yanıtlayacak. (Bu, taklit bir onaydır — aslında hiçbir şey gönderilmedi.)",
  "contact.success.bodyPersist":
    "Teşekkürler — Slotera bir iş günü içinde size ulaşacak.",

  "booking.step.service": "Hizmet",
  "booking.step.time": "Zaman",
  "booking.step.details": "Bilgiler",
  "booking.step.forms": "Formlar",
  "booking.step.billing": "Fatura",
  "booking.step.review": "Özet",
  "booking.step.pay": "Ödeme",
  "booking.back": "Geri",
  "booking.continue": "Devam",
  "booking.payConfirm": "Öde ve onayla",
  "booking.reservePay": "Rezerve et ve öde",
  "booking.confirm": "Rezervasyonu onayla",

  "booking.topbar.with": "Şununla rezervasyon:",
  "booking.topbar.secure": "SSL korumalı · UK GDPR'a duyarlı",
  "booking.footer.secure": "Güvenli ödeme · Slotera ile",

  "booking.intro.title": "Strateji danışmanı",

  "booking.datetime.availableTimes": "Uygun saatler",
  "booking.datetime.pickDate": "Uygun saatleri görmek için bir tarih seçin.",
  "booking.datetime.prevMonth": "Önceki ay",
  "booking.datetime.nextMonth": "Sonraki ay",

  "booking.details.firstName": "Ad",
  "booking.details.lastName": "Soyad",
  "booking.details.email": "E-posta",
  "booking.details.phone": "Telefon",
  "booking.details.company": "Şirket",
  "booking.details.notes": "Görüşmeden önce paylaşmak istediğiniz bir şey var mı?",
  "booking.details.consent": "{terms} kabul ediyorum.",
  "booking.details.consentLink": "Koşulları ve Gizlilik Politikası'nı",

  "booking.legal.title": "Koşullar ve Gizlilik Politikası",
  "booking.legal.description":
    "Bu hizmet sağlayıcının belirlediği rezervasyon koşulları ile Slotera'nın platform koşulları ve gizlilik bildirimi.",
  "booking.legal.tab.provider": "Sağlayıcı Rezervasyon Koşulları",
  "booking.legal.tab.platform": "Slotera Koşulları ve Gizlilik",
  "booking.legal.defaultProviderTerms":
    "Bu sağlayıcı özel rezervasyon koşulları belirlememiş. Standart iptal ve iade koşulları geçerlidir — sorularınız için lütfen doğrudan sağlayıcıyla iletişime geçin.",
  "booking.legal.termsHeading": "Koşullar",
  "booking.legal.privacyHeading": "Gizlilik",

  "booking.field.yes": "Evet",
  "booking.field.no": "Hayır",
  "booking.field.select": "Seçin…",

  "booking.packages.hintTitle": "Paketlerde mevcut",
  "booking.packages.hintBody":
    "Bu seans, bir veya daha fazla çok seanslı pakete dahildir.",
  "booking.packages.viewOptions": "Paket seçeneklerini gör",
  "booking.packages.modalTitle": "Paket seçenekleri",
  "booking.packages.modalBody":
    "Bu paketler bu seansı içerir. Paket satın alma bu demoda yer almıyor — devam etmek için tek bir seans rezerve edin.",
  "booking.packages.featured": "Öne çıkan",
  "booking.packages.sessionsSuffix": "seans",

  "booking.billing.line1": "Adres satırı 1",
  "booking.billing.line1.placeholder": "Sokak ve numara",
  "booking.billing.line2": "Adres satırı 2",
  "booking.billing.line2.placeholder": "Daire, kat, blok vb.",
  "booking.billing.city": "Şehir",
  "booking.billing.region": "Eyalet / Bölge / İl",
  "booking.billing.country": "Ülke",
  "booking.billing.postal": "Posta kodu",

  "booking.review.service": "Hizmet",
  "booking.review.when": "Zaman",
  "booking.review.details": "Bilgileriniz",
  "booking.review.forms": "Formlar",
  "booking.review.formsCompleted": "{count} form tamamlandı",
  "booking.review.billing": "Fatura",
  "booking.review.edit": "Düzenle",

  "booking.receipt.paymentReceipt": "Ödeme makbuzu",
  "booking.receipt.orderSummary": "Sipariş özeti",
  "booking.receipt.almostDone": "Neredeyse bitti",
  "booking.receipt.reviewBooking": "Rezervasyonunuzu gözden geçirin",
  "booking.receipt.service": "Hizmet",
  "booking.receipt.client": "Müşteri",
  "booking.receipt.billingAddress": "Fatura adresi",
  "booking.receipt.subtotal": "Ara toplam",
  "booking.receipt.total": "Toplam",
  "booking.receipt.paymentMethod": "Ödeme yöntemi",
  "booking.receipt.manualInstructions": "Manuel ödeme talimatları",
  "booking.receipt.footerManual":
    "Manuel ödemelerde rezervasyonunuz kesinleşmeden önce sağlayıcının onayı gerekir.",
  "booking.receipt.footerCard": "Şifrelenmiş · Stripe ile PCI-DSS (taklit)",
  "booking.receipt.footerReview":
    "Bir sonraki adımda onaylayana kadar herhangi bir ücret alınmaz.",

  "booking.payment.method": "Ödeme yöntemi",
  "booking.payment.card": "Kart",
  "booking.payment.manual": "Manuel ödeme",
  "booking.payment.cardholderName": "Kart sahibinin adı",
  "booking.payment.cardNumber": "Kart numarası",
  "booking.payment.cardNumberHint":
    "Taklit başarı için 4242 4242 4242 4242, taklit hata için 4000 0000 0000 0002 kullanın.",
  "booking.payment.expiration": "Son kullanma",
  "booking.payment.cvc": "CVC",
  "booking.payment.instructions": "Ödeme talimatları",
  "booking.payment.instructionsFallback":
    "Ödeme talimatları siz onayladıktan sonra paylaşılacaktır.",
  "booking.payment.pendingNote":
    "Sağlayıcı ödemeyi aldığını onaylayana kadar rezervasyonunuz beklemede olarak işaretlenecektir.",

  "booking.confirm.title": "Rezervasyonunuz onaylandı.",
  "booking.confirm.emailSent": "{email} adresine bir onay e-postası gönderdik.",
  "booking.confirm.emailSentNoAddress": "Bir onay e-postası gönderdik.",
  "booking.confirm.reference": "Referans {ref}",
  "booking.confirm.service": "Hizmet",
  "booking.confirm.when": "Ne zaman",
  "booking.confirm.where": "Nerede",
  "booking.confirm.attendee": "Katılımcı",
  "booking.confirm.meetingLink": "Toplantı bağlantısı",
  "booking.confirm.copyLink": "Toplantı bağlantısını kopyala",
  "booking.confirm.copied": "Kopyalandı",
  "booking.confirm.bookAnother": "Başka bir seans rezerve et",
  "booking.confirm.manage": "Rezervasyonu yönet",
  "booking.confirm.addCalendar.title": "Takvime ekle",
  "booking.confirm.addCalendar.body": "Google · Apple · Outlook · ICS",
  "booking.confirm.invoice.title": "Faturayı indir",
  "booking.confirm.invoice.body": "PDF, faturaya hazır",
  "booking.confirm.forward.title": "E-postayı ilet",
  "booking.confirm.forward.body": "Bir meslektaşınızı dahil edin",

  "booking.failure.title": "Ödeme reddedildi.",
  "booking.failure.body":
    "Bu kartı işleyemedik. Başka bir kart deneyebilir veya farklı bir ödeme yöntemi seçebilirsiniz.",
  "booking.failure.backToPayment": "Ödemeye dön",
  "booking.failure.cancel": "Rezervasyonu iptal et",

  "booking.datetime.spotsLeft": "{count} yer kaldı",
  "manage.eyebrow": "Rezervasyonunuz",
  "manage.loading": "Rezervasyonunuz yükleniyor…",
  "manage.invalid.title": "Bu bağlantı çalışmıyor.",
  "manage.invalid.body": "Bağlantının süresi dolmuş olabilir. Bu rezervasyonla ilgili en yeni e-postayı kullanın ya da hizmet sağlayıcıyla iletişime geçin.",
  "manage.status.confirmed": "Onaylandı",
  "manage.status.pending": "Beklemede",
  "manage.status.cancelled": "İptal edildi",
  "manage.status.completed": "Tamamlandı",
  "manage.status.noshow": "Katılınmadı",
  "manage.pending.approval": "Hizmet sağlayıcının onayı bekleniyor.",
  "manage.pending.payment": "Ödemeniz bekleniyor.",
  "manage.when": "Ne zaman",
  "manage.where": "Nerede",
  "manage.provider": "Hizmet sağlayıcı",
  "manage.amount": "Tutar",
  "manage.paymentDue": "Son ödeme {date}",
  "manage.paymentInstructions": "Ödeme talimatları",
  "manage.policy": "İptal politikası",
  "manage.changeUntil": "Bu rezervasyonu {date} tarihine kadar çevrim içi değiştirebilirsiniz.",
  "manage.changeClosed": "Bu rezervasyon artık çevrim içi değiştirilemez. Değiştirmek için {name} ile iletişime geçin.",
  "manage.rescheduleOnce": "Bu rezervasyonu zaten bir kez taşıdınız. Tekrar değiştirmek için {name} ile iletişime geçin.",
  "manage.reschedule": "Yeni bir saat seçin",
  "manage.reschedule.confirm": "Bu saate taşı",
  "manage.reschedule.cancel": "Mevcut saati koru",
  "manage.reschedule.done": "Rezervasyonunuz taşındı.",
  "manage.cancel": "Rezervasyonu iptal et",
  "manage.cancel.title": "Bu rezervasyon iptal edilsin mi?",
  "manage.cancel.body": "Yeriniz serbest bırakılır. İadeler, hizmet sağlayıcının iptal politikasına göre yapılır.",
  "manage.cancel.keep": "Rezervasyonu koru",
  "manage.cancel.done": "Rezervasyonunuz iptal edildi.",
  "manage.contact": "İletişim",

  "system.notFound.title": "Bu sayfa mevcut değil.",
  "system.notFound.body":
    "Bağlantı bozuk olabilir veya sayfa taşınmış olabilir. Geri dönüp oradan tekrar deneyin.",
  "system.notFound.home": "Ana sayfaya dön",
  "system.maintenance.eyebrow": "Planlı bakım",
  "system.maintenance.title": "Birazdan döneceğiz.",
  "system.maintenance.body":
    "Slotera güncelleniyor. Rezervasyonlarınız ve verileriniz güvende — lütfen birkaç dakika sonra tekrar deneyin.",
  "system.maintenance.retry": "Tekrar dene",

  "booking.paused.title": "Rezervasyonlar duraklatıldı",
  "booking.paused.body":
    "Bu rezervasyon sayfası şu anda yeni rezervasyon kabul etmiyor. İletişime geçmek isterseniz bir mesaj gönderin, size dönelim.",
  "booking.paused.cta": "İletişime geçin",

  // Demo rezervasyon/buchung yönetimi (/booking/manage/demo)
  "bookingManage.badge": "Demo",
  "bookingManage.title": "Rezervasyonunuz",
  "bookingManage.subtitle":
    "Müşterilerinizin rezervasyondan sonra görebileceklerinin bir önizlemesi — ayrıntıları inceleyin, isteğe bağlı formları doldurun, rezervasyonu yönetin ve iletişimde kalın. Bu, taklit verilerle hazırlanmış bir demodur.",
  "bookingManage.tabsLabel": "Rezervasyon bölümleri",
  "bookingManage.tab.info": "Rezervasyon bilgisi",
  "bookingManage.tab.manage": "Rezervasyonu yönet",
  "bookingManage.tab.forms": "Formlar",
  "bookingManage.tab.payment": "Ödeme",
  "bookingManage.tab.package": "Paket",
  "bookingManage.status.confirmed": "Onaylandı",
  "bookingManage.location.online": "Çevrimiçi — toplantı bağlantısı e-postayla gönderildi",
  "bookingManage.reminder":
    "Seansınızdan 24 saat önce bir hatırlatma alacaksınız.",
  "bookingManage.disclaimer":
    "Bu bir demo sayfasıdır. Müşterilerin hesabı yoktur — üretimde bu sayfa, e-postayla gönderilen güvenli bir rezervasyon bağlantısından açılırdı.",
  "bookingManage.back": "Rezervasyon sayfasına dön",
  "bookingManage.backHome": "Ana sayfaya dön",
  "bookingManage.info.title": "Rezervasyon bilgisi",
  "bookingManage.info.service": "Hizmet",
  "bookingManage.info.provider": "Sağlayıcı",
  "bookingManage.info.when": "Tarih ve saat",
  "bookingManage.info.location": "Konum",
  "bookingManage.info.reference": "Rezervasyon referansı",
  "bookingManage.info.context.none":
    "Her şey hazır — seansınızdan önce tamamlamanız gereken bir şey yok.",
  "bookingManage.info.context.one":
    "Seansınızdan önce tamamlanacak 1 isteğe bağlı form var.",
  "bookingManage.info.context.many":
    "Seansınızdan önce tamamlanacak {n} isteğe bağlı form var.",
  "bookingManage.message.title": "Sağlayıcıya mesaj gönderin",
  "bookingManage.message.note":
    "Rezervasyonunuzla ilgili sağlayıcıya her şeyi sorun. E-postayla size dönecekler.",
  "bookingManage.message.placeholder": "Sağlayıcıya kısa bir mesaj yazın…",
  "bookingManage.message.send": "Mesaj gönder",
  "bookingManage.message.sent": "Mesaj gönderildi",
  "bookingManage.message.sentDesc": "Teşekkürler — sağlayıcı size dönecek (taklit).",
  "bookingManage.manage.title": "Rezervasyonu yönet",
  "bookingManage.manage.note":
    "Bir değişiklik mi gerekiyor? Bir talep gönderin, sağlayıcınız sizinle iletişime geçsin.",
  "bookingManage.actions.reschedule": "Yeniden planlama talep et",
  "bookingManage.actions.cancel": "İptal talep et",
  "bookingManage.reschedule.title": "Yeniden planlama talep edin",
  "bookingManage.reschedule.body":
    "Farklı bir saat istediğinizi sağlayıcıya ileteceğiz. Yeni bir saati onaylamak için sizinle iletişime geçecekler. (Taklit — aslında hiçbir şey gönderilmez.)",
  "bookingManage.reschedule.confirm": "Yeniden planlama talep et",
  "bookingManage.reschedule.sent": "Yeniden planlama talep edildi",
  "bookingManage.reschedule.sentDesc":
    "Sağlayıcı yeni bir saat için sizinle iletişime geçecek (taklit).",
  "bookingManage.cancel.title": "İptal talep edin",
  "bookingManage.cancel.body":
    "İptal etmek istediğinizi sağlayıcıya ileteceğiz. Olası iade, iptal politikalarına tabidir. (Taklit — aslında hiçbir şey iptal edilmez.)",
  "bookingManage.cancel.confirm": "İptal talep et",
  "bookingManage.cancel.sent": "İptal talep edildi",
  "bookingManage.cancel.sentDesc":
    "Sağlayıcı iptalinizle ilgili sizinle iletişime geçecek (taklit).",
  "bookingManage.forms.title": "Formlar",
  "bookingManage.forms.note":
    "Sağlayıcınızın bu rezervasyona eklediği formlar. Zorunlu formlar ödemeden önce dolduruldu; isteğe bağlı olanları seansınızdan önce herhangi bir zamanda doldurabilirsiniz.",
  "bookingManage.forms.required": "Zorunlu",
  "bookingManage.forms.optional": "İsteğe bağlı",
  "bookingManage.forms.completed": "Tamamlandı",
  "bookingManage.forms.notCompleted": "Tamamlanmadı",
  "bookingManage.forms.open": "Doldur",
  "bookingManage.forms.view": "Görüntüle",
  "bookingManage.forms.save": "Formu kaydet",
  "bookingManage.forms.saved": "Form kaydedildi",
  "bookingManage.forms.savedDesc": "Teşekkürler — yanıtlarınız kaydedildi (taklit).",
  "bookingManage.forms.readonlyNote":
    "Bu formu ödemeden önce doldurdunuz. Yanıtlarınız salt okunurdur.",
  "bookingManage.form.intake.name": "Tanışma anketi",
  "bookingManage.form.intake.desc": "Ödemeden önce dolduruldu.",
  "bookingManage.form.intake.field": "Neye odaklanmak istersiniz?",
  "bookingManage.form.intake.answer":
    "Onboarding sürecimizi ölçeklendirmek ve ilk 30 gündeki aktivasyonu iyileştirmek.",
  "bookingManage.form.notes.name": "Seansınızdan önce ek notlar",
  "bookingManage.form.notes.desc": "Sağlayıcının önceden bilmesini istediğiniz her şey.",
  "bookingManage.form.notes.field": "Notlarınız",
  "bookingManage.form.notes.placeholder": "ör. bağlam, hedefler, görüşmek istediğiniz sorular…",
  "bookingManage.form.update.name": "Seans öncesi güncelleme",
  "bookingManage.form.update.desc": "Sağlayıcının hazırlanabilmesi için kısa bir bilgilendirme.",
  "bookingManage.form.update.field": "Rezervasyondan bu yana değişen bir şey var mı?",
  "bookingManage.payment.title": "Ödeme",
  "bookingManage.payment.method": "Ödeme yöntemi",
  "bookingManage.payment.manualLabel": "Manuel ödeme",
  "bookingManage.payment.statusLabel": "Durum",
  "bookingManage.payment.statusValue": "Manuel ödeme bekleniyor",
  "bookingManage.payment.subtotal": "Ara toplam",
  "bookingManage.payment.tax": "Vergi",
  "bookingManage.payment.total": "Toplam",
  "bookingManage.payment.instructionsLabel": "Ödeme talimatları",
  "bookingManage.package.title": "Paket",
  "bookingManage.package.session": "Seans {n}/{total}",
  "bookingManage.package.note":
    "Bu rezervasyon, sağlayıcınızın oluşturduğu çok seanslı bir paketin parçasıdır.",
  "bookingManage.package.included": "Dahil olan seanslar",
  "bookingManage.package.thisSession": "Bu seans",

  "auth.login.submit": "Giriş yap",
  "auth.register.submit": "Hesap oluştur",
  "auth.field.email": "E-posta",
  "auth.field.password": "Şifre",

  "forms.title": "Formlar",
  "forms.new": "Yeni form",

  "demoGuide.eyebrow": "Demo rehberi",
  "demoGuide.title": "Slotera'ya hoş geldiniz",
  "demoGuide.disclaimer":
    "Bu, Slotera'nın ana rezervasyon ve yönetim akışlarını gösteren bir demo sürümüdür. Ürün geliştirilirken bazı özellikler taklittir.",
  "demoGuide.youCanTry": "Şunları deneyebilirsiniz:",
  "demoGuide.step.dashboard.title": "Hizmet sağlayıcının tarafını görün — yönetim paneli",
  "demoGuide.step.dashboard.body":
    "Rezervasyonları, hizmetleri ve formları yönetmek, takvimi ve ayarları keşfetmek için sağlayıcının çalışma alanına geçin.",
  "demoGuide.step.dashboard.cta": "Yönetim panelini aç",
  "demoGuide.step.booking.title": "Genel rezervasyon sayfasını test edin",
  "demoGuide.step.booking.body":
    "Müşterilerin bir hizmeti baştan sona nasıl rezerve ettiğini görün.",
  "demoGuide.step.booking.tryAs": "Şu rolde deneyin:",
  "demoGuide.step.booking.defaultLink": "Standart rezervasyon sayfasını aç",
  "demoGuide.persona.consultant": "Danışman",
  "demoGuide.persona.coach": "Koç",
  "demoGuide.persona.instructor": "Eğitmen",
  "demoGuide.step.manage.title": "Müşteri rezervasyon sayfasını görün",
  "demoGuide.step.manage.body":
    "Rezervasyon sonrası deneyimi görün: rezervasyon ayrıntıları, isteğe bağlı formlar, sağlayıcıya mesaj gönderme ve yeniden planlama veya iptal talebi.",
  "demoGuide.step.manage.cta": "Rezervasyon sayfasını aç",
  "demoGuide.noteLabel": "Not:",
  "demoGuide.note":
    "Bu bir demo ortamıdır, bu nedenle bazı akışlar ürün geliştirilirken taklit veri kullanır. Bir şey yanlış görünürse, bir hata veya bozuk akış fark ederseniz, bir iş talebiniz ya da özellik öneriniz varsa veya Slotera'yı konuşmak isterseniz bize ulaşın.",
  "demoGuide.contact": "Bize ulaşın",
  "demoGuide.createAccount": "Bunun yerine hesap oluştur",
  "demoGuide.close": "Kapat",
  "demoGuide.startExploring": "Keşfetmeye başla",
};
