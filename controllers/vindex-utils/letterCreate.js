const puppeteer = require("puppeteer");
const fs = require("fs");
const path = require("path");

const toBase64 = (filePath) => {
  try {
    const bitmap = fs.readFileSync(filePath);
    return `data:image/png;base64,${bitmap.toString("base64")}`;
  } catch (e) {
    console.error(`Błąd wczytywania obrazu: ${filePath}`);
    return "";
  }
};

const today = new Date();
const formattedDate =
  today.toLocaleDateString("pl-PL", {
    day: "numeric",
    month: "long",
    year: "numeric",
  }) + " roku";

// --- KOMPLETNE DANE (WSZYSTKIE TEKSTY PRZENIESIONE DO ZMIENNYCH) ---
const documentData = {
  header: {
    place: "Łódź",
    date: formattedDate,
    krd_box_text:
      "Informacje o nieuregulowanych zobowiązaniach będą przekazane do Krajowego Rejestru Długów Biura Informacji Gospodarczej SA, zgodnie z Ustawą z dnia 9 kwietnia 2010 r. o udostępnianiu informacji gospodarczych i wymianie danych gospodarczych www.krd.pl",
  },
  recipient: {
    name: "KZ TRANSPORT S.C.",
    street: "ul. Podgórna 9 C/B / 9",
    city: "84-230 Rumia",
    nip: "588-239-30-78",
  },
  title: "OSTATECZNE PRZEDSĄDOWE WEZWANIE DO ZAPŁATY",
  subtitle1: "z ostrzeżeniem o możliwości wpisania dłużnika do",
  subtitle2: "Krajowego Rejestru Długów Biura Informacji Gospodarczej S.A.",
  body_top_intro: "Wzywamy Państwa do zapłaty roszczenia w wysokości",
  body_top_reason:
    "z tytułu nieopłaconych faktur wyszczególnionych w poniższej tabeli, wraz z <strong>odsetkami za opóźnienie</strong> i rekompensatą za <strong>koszty dochodzenia należności</strong>, zgodnie z art. 10 ust. 1 pkt. 1 ustawy o przeciwdziałaniu nadmiernym opóźnieniom w transakcjach handlowych,",
  deadline_text:
    "w nieprzekraczalnym terminie 3 dni od daty otrzymania niniejszego pisma.",

  settlements: [
    {
      doc_nr: "912800368558",
      issue_date: "2025-11-24",
      due_date: "2025-11-24",
      initial_val: "2 875,00 zł",
      remaining_val: "2 875,00 zł",
      interest: "57,67 zł.",
    },
    {
      doc_nr:
        "40 euro zgodnie z art. 10 ust. 1 pkt. 1 ustawy o przeciwdziałaniu nadmiernym opóźnieniom w transakcjach handl.",
      issue_date: "2025-12-17",
      due_date: "2025-12-17",
      initial_val: "171,81 zł.",
      remaining_val: "171,81 zł.",
      interest: "",
    },
  ],

  total_amount: "3 104,48 zł",

  bank_details: {
    intro:
      "Łączną kwotę należności, należy uiścić na następujący rachunek bankowy Spółki:",
    company: "Krotoski sp. z o.o.",
    address: "Niciarniana 51/53, 92-320 Łódź",
    account: "28 1140 1124 0000 3020 3800 1042",
  },

  legal_warning:
    "Brak zapłaty wskazanych kwot w powyższym terminie, spowoduje <strong><u>niezwłoczne skierowanie sprawy na drogę postępowania sądowego</u></strong>, co będzie się wiązać z <strong>dodatkowymi, znacznymi kosztami</strong>.",

  // Strona 2
  krd_legal_note:
    'Ponadto spowoduje <strong>przekazanie informacji o Państwa zadłużeniu do <span class="underline">REJESTRU DŁUŻNIKÓW KRD</span></strong> na podstawie ustawy z dnia 9 kwietnia 2010 r. o udostępnianiu informacji gospodarczych i wymianie danych gospodarczych (Dz.U. Nr 81, poz. 530 ze zm.).',
  impact_intro:
    "Wpis o Państwa zadłużeniu w <strong>Krajowym Rejestrze Długów BIG S.A</strong> znacząco utrudni bądź uniemożliwi:",
  krd_impact_list: [
    "uzyskanie kredytów i pożyczek bankowych oraz innych usług i produktów bankowych, takich jak karty kredytowe czy limit debetowy na koncie osobistym/firmowym;",
    "dokonywanie zakupów na raty;",
    "zawieranie umów cywilnoprawnych takich jak np. umowy najmu;",
    "podpisanie lub przedłużenie umowy na: telefon komórkowy, dostęp do Internetu, dostawy prądu, gazu i wielu innych.",
  ],
  closing_info:
    "Jednocześnie informujemy, iż <strong>wyłącznie całkowita spłata zadłużenia</strong> spowoduje usunięcie informacji z Krajowego Rejestru Długów Biura Informacji Gospodarczej S.A.",
  email_contact: "windykacja@krotoski.com",
  final_note_template:
    "Jeżeli płatność została uregulowana przed otrzymaniem niniejszego pisma, prosimy uznać je za niebyłe i przesłać potwierdzenie przelewu na e-mail: ",

  signature: {
    label: "Z poważaniem",
    department: "Dział Nadzoru i Kontroli Należności",
  },
};

const generateDebtNoticePdf = async () => {
  try {
    const browser = await puppeteer.launch({
      headless: "new",
      args: ["--no-sandbox", "--disable-setuid-sandbox"],
    });

    const page = await browser.newPage();

    const assetsPath = path.join(__dirname, "assets");

    // Wczytywanie obrazów (Base64) - Użyte nazwy z Twojego ostatniego logu
    const logoKrdBase64 = toBase64(path.join(assetsPath, "logo-krd.png"));
    const logoKrotoskiBase64 = toBase64(
      path.join(assetsPath, "logo-krotoski.png")
    );
    const logoVwBase64 = toBase64(path.join(assetsPath, "logo_vw.png"));
    const logoAudiBase64 = toBase64(path.join(assetsPath, "logo_audi.png"));
    const logoSeatBase64 = toBase64(path.join(assetsPath, "logo_seat.png"));
    const logoSkodaBase64 = toBase64(path.join(assetsPath, "logo_skoda.png"));
    const logoPorscheBase64 = toBase64(
      path.join(assetsPath, "logo_porsche.png")
    );
    const logoVwUBase64 = toBase64(path.join(assetsPath, "logo_vw_dost.png"));

    const htmlContent = `
<!DOCTYPE html>
<html lang="pl">
<head>
    <meta charset="UTF-8">
    <style>
        @import url('https://fonts.googleapis.com/css2?family=Source+Sans+3:wght@400;600;700;900&display=swap');
        :root { --primary-red: #e20613; --krd-blue: #005696; --table-blue: #00a9e0; --page-width: 210mm; --page-height: 297mm; }
        body { margin: 0; padding: 0; background-color: #ffffff; font-family: "Source Sans 3", sans-serif; }
        .page { background: white; width: var(--page-width); height: var(--page-height); padding: 15mm 15mm 20mm 15mm; box-sizing: border-box; display: flex; flex-direction: column; position: relative; page-break-after: always; }
        .page-header { display: flex; justify-content: space-between; margin-bottom: 10px; }
        .krd-promo-box {  margin: 30px auto; border: 2px solid var(--primary-red);  border-radius: 10px;}
        .img-krd-stamp { width: 280px; height: auto; border: 2px solid var(--primary-red); border-radius: 10px; }
        .img-krd-stamp--large { width: 380px; height: auto; }
        .krotoski-logo-container { text-align: right; }
        .img-krotoski-main { width: 180px; margin-bottom: 5px; }
        .date-line { font-size: 10pt; }
        .recipient-section { display: flex; justify-content: flex-end; margin-bottom: 40px; padding-left: 40px; }
        .recipient-address { width: 45%; font-size: 1.1rem; line-height: 1.4; }
        .recipient-address p { margin: 0; }
        .title-section { text-align: center; margin-bottom: 30px; }
        .title-section h1 { color: var(--primary-red); font-size: 19pt; font-weight: 900; margin: 0; }
        .title-section h3 { color: var(--krd-blue); font-size: 1.1rem; text-decoration: underline; margin: 2px 0; }
        .intro-text { font-size: 10.5pt; line-height: 1.5; text-align: justify; }
        .deadline-highlight { color: var(--primary-red); font-weight: 700; text-decoration: underline; text-align: center; font-size: 12pt; margin: 20px 0; }
        .grid-table-container { margin: 20px 0; }
        .grid-header { display: grid; grid-template-columns: 2fr 1fr 1fr 1fr 1fr 0.8fr; background-color: var(--table-blue); border: 1px solid black; font-weight: 700; font-size: 8.5pt; text-align: center; }
        .grid-header > div { padding: 8px 4px; border-right: 1px solid black; display: flex; align-items: center; justify-content: center; }
        .grid-row { display: grid; grid-template-columns: 2fr 1fr 1fr 1fr 1fr 0.8fr; border: 1px solid black; border-top: none; font-size: 9pt; }
        .grid-row > div { padding: 8px 4px; border-right: 1px solid black; display: flex; align-items: center; justify-content: center; }
        .col-nr { justify-content: flex-start !important; text-align: left !important; font-weight: 600; }
        .grid-total-row { text-align: right; font-weight: 900; font-size: 12pt; margin-top: 10px; }
        .payment-info { text-align: center; margin: 5px 0; }
        .company-info-bold { font-weight: 700; text-decoration: underline; margin: 0; }
        .account-number-large { font-size: 1rem; font-weight: 900; text-decoration: underline; display: block; margin-top: 5px; }
        .legal-warning-container { font-size: 10.5pt; line-height: 1.4; text-align: justify; margin-bottom: 25px; }
        .impact-list { padding-left: 20px; margin-bottom: 20px; }
        .impact-list li { margin-bottom: 8px; font-size: 10pt; text-align: justify; }
        .underline { text-decoration: underline; }
        .italic-text { font-style: italic; }
        .signature-block { margin-top: 40px; text-align: center; padding-left: 60%; }
        .signature-dept { font-weight: 700; font-size: 11pt; }
        .brands-footer { position: absolute; bottom: 20mm; left: 15mm; right: 15mm; border-top: 2px solid #333; padding-top: 10px; display: flex; justify-content: space-between; align-items: center; }
        .footer-logos-side { display: flex; align-items: center; gap: 20px; height: 40px; }
        .footer-brand-img { height: 35px; width: auto; max-width: 60px; object-fit: contain; }
        .page-footer { position: absolute; bottom: 10mm; right: 15mm; font-size: 8pt; color: #999; }
    </style>
</head>
<body>
    <div class="document-container">
        <!-- STRONA 1 -->
        <div class="page">
            <header class="page-header">
                <img src="${logoKrdBase64}" class="img-krd-stamp">
                <div class="krotoski-logo-container">
                    <img src="${logoKrotoskiBase64}" class="img-krotoski-main">
                    <div class="date-line">${documentData.header.place}, dnia ${documentData.header.date}</div>
                </div>
            </header>

            <section class="recipient-section">
                <div class="recipient-address">
                    <p><strong>${documentData.recipient.name}</strong></p>
                    <p>${documentData.recipient.street}</p>
                    <p>${documentData.recipient.city}</p>
                    <p>NIP: ${documentData.recipient.nip}</p>
                </div>
            </section>

            <section class="title-section">
                <h1>${documentData.title}</h1>
                <h3>${documentData.subtitle1}</h3>
                <h3>${documentData.subtitle2}</h3>
            </section>

            <section class="intro-text">
                <p>${documentData.body_top_intro} <strong>${documentData.total_amount}</strong> ${documentData.body_top_reason}</p>
            </section>

            <p class="deadline-highlight">${documentData.deadline_text}</p>

            <section class="grid-table-container">
                <div class="grid-header">
                    <div>Nr. Dokumentu</div><div>Data wystawienia</div><div>Termin płatności</div><div>Wartość początkowa</div><div>Pozostała do zapłaty</div><div>Odsetki</div>
                </div>
                ${documentData.settlements
                  .map(
                    (item) => `
                    <div class="grid-row">
                        <div class="col-nr">${item.doc_nr}</div>
                        <div>${item.issue_date}</div>
                        <div>${item.due_date}</div>
                        <div>${item.initial_val}</div>
                        <div>${item.remaining_val}</div>
                        <div>${item.interest}</div>
                    </div>
                `
                  )
                  .join("")}
                <div class="grid-total-row">Łącznie do zapłaty: ${documentData.total_amount}</div>
            </section>

            <section class="payment-info">
                <p>${documentData.bank_details.intro}</p>
                <p class="company-info-bold">${documentData.bank_details.company}, ${documentData.bank_details.address}</p>
                <span class="account-number-large">${documentData.bank_details.account} bank</span>
            </section>
            <section class="legal-warning-container">
                <p>${documentData.legal_warning}</p>
            </section>
            <footer class="page-footer">Strona 1 z 2</footer>
        </div>

        <!-- STRONA 2 -->
        <div class="page">
       

            <section class="legal-info-section">
                <p>${documentData.krd_legal_note}</p>
                <p class="italic-text">${documentData.impact_intro}</p>
                <ul class="impact-list">
                    ${documentData.krd_impact_list.map((li) => `<li>${li}</li>`).join("")}
                </ul>
                <p>${documentData.closing_info}</p>
            </section>

            <section class="krd-promo-box">
                <img src="${logoKrdBase64}" class="img-krd-stamp--large">
            </section>

            <section class="contact-note">
                <p>${documentData.final_note_template} <a href="mailto:${documentData.email_contact}">${documentData.email_contact}</a></p>
            </section>

            <section class="signature-block">
                <p><strong>${documentData.signature.label}</strong></p>
                <p class="signature-dept">${documentData.signature.department}</p>
            </section>

            <div class="brands-footer">
                <div class="footer-krotoski-side">
                    <img src="${logoKrotoskiBase64}" class="img-krotoski-main">
                </div>
                <div class="footer-logos-side">
                    <img src="${logoVwBase64}" class="footer-brand-img">
                    <img src="${logoAudiBase64}" class="footer-brand-img">
                    <img src="${logoSeatBase64}" class="footer-brand-img">
                    <img src="${logoSkodaBase64}" class="footer-brand-img">
                    <img src="${logoPorscheBase64}" class="footer-brand-img">
                    <img src="${logoVwUBase64}" class="footer-brand-img">
                </div>
            </div>
            <footer class="page-footer">Strona 2 z 2</footer>
        </div>
    </div>
</body>
</html>`;

    await page.setContent(htmlContent, { waitUntil: "networkidle0" });
    const pdfBuffer = await page.pdf({
      format: "A4",
      printBackground: true,
      margin: { top: "0px", right: "0px", bottom: "0px", left: "0px" },
    });

    await browser.close();
    return pdfBuffer;
  } catch (error) {
    console.error("Błąd generowania PDF:", error);
  }
};

module.exports = { generateDebtNoticePdf };
