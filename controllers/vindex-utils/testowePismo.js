const puppeteer = require("puppeteer");
const fs = require("fs");
const path = require("path");

// Funkcja pomocnicza do formatowania waluty (np. 3 104,48 zł)
const formatCurrency = (value) => {
  if (typeof value === "string") value = parseFloat(value.replace(",", "."));
  return (
    new Intl.NumberFormat("pl-PL", {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    }).format(value) + " zł"
  );
};

const toBase64 = (filePath) => {
  try {
    const bitmap = fs.readFileSync(filePath);
    return `data:image/png;base64,${bitmap.toString("base64")}`;
  } catch (e) {
    console.error(`Błąd wczytywania obrazu: ${filePath}`);
    return "";
  }
};

const TABLE_COLUMNS = [
  { id: "doc_nr", label: "Nr. Dokumentu", width: "2.4fr" },
  { id: "issue_date", label: "Data wystawienia", width: "1fr" },
  { id: "due_date", label: "Termin płatności", width: "1fr" },
  { id: "initial_val", label: "Wartość początkowa", width: "1.2fr" },
  { id: "remaining_val", label: "Pozostała do zapłaty", width: "1.2fr" },
  { id: "interest", label: "Odsetki", width: "0.9fr" },
];

const generateDebtNoticePdf = async (docData) => {
  try {
    // 1. PRZYGOTOWANIE DANYCH NA PODSTAWIE TABLICY docData
    // Zakładamy, że bierzemy dane adresowe z pierwszego elementu tablicy
    const firstItem = docData[0];

    // Budowanie adresu (pomijanie nulli)
    const streetParts = [
      firstItem.A_PRZEDROSTEK,
      firstItem.A_ULICA_EXT,
      firstItem.A_NRDOMU,
    ]
      .filter(Boolean)
      .join(" ");

    const fullStreet = firstItem.A_NRLOKALU
      ? `${streetParts} / ${firstItem.A_NRLOKALU}`
      : streetParts;

    const fullCity =
      `${firstItem.A_KOD || ""} ${firstItem.A_MIASTO || ""}`.trim();

    // Logika tabeli (settlements) i obliczeń
    let totalSum = 0;
    const settlements = [];

    // Dla każdej faktury w docData tworzymy dwa wiersze: fakturę i rekompensatę 40 EUR
    docData.forEach((item) => {
      const principal = parseFloat(item.AS_DO_ROZLICZENIA) || 0;
      const interestVal = 57.67; // Stała wartość odsetek zgodnie z Twoim opisem (do późniejszej zmiany)
      const compensationVal = 171.81; // Stała wartość 40 EUR (171,81 zł)

      // Wiersz 1: Faktura
      settlements.push({
        doc_nr: item.NUMER_FV,
        issue_date: item.DATA_FV,
        due_date: item.TERMIN,
        initial_val: formatCurrency(principal),
        remaining_val: formatCurrency(principal),
        interest: formatCurrency(interestVal),
      });

      // Wiersz 2: Rekompensata 40 EUR
      settlements.push({
        doc_nr:
          "40 euro zgodnie z art. 10 ust. 1 pkt. 1 ustawy o przeciwdziałaniu nadmiernym opóźnieniom w transakcjach handl.",
        issue_date: item.DATA_FV,
        due_date: item.TERMIN,
        initial_val: formatCurrency(compensationVal),
        remaining_val: formatCurrency(compensationVal),
        interest: "",
      });

      // Sumowanie wszystkiego do total_amount
      totalSum += principal + interestVal + compensationVal;
    });

    const formattedTotal = formatCurrency(totalSum);

    // Formatuje dzisiejszą datę
    const today = new Date();
    const formattedDate =
      today.toLocaleDateString("pl-PL", {
        day: "numeric",
        month: "long",
        year: "numeric",
      }) + " roku";

    // 2. KONFIGURACJA PUPPETEER
    const browser = await puppeteer.launch({
      headless: "new",
      args: ["--no-sandbox", "--disable-setuid-sandbox"],
    });

    const page = await browser.newPage();
    const assetsPath = path.join(__dirname, "assets");

    // Obrazy Base64 (ścieżki muszą być poprawne w Twoim systemie)
    const images = {
      logoKrd: toBase64(path.join(assetsPath, "logo-krd.png")),
      logoKrotoski: toBase64(path.join(assetsPath, "logo-krotoski.png")),
      logoVw: toBase64(path.join(assetsPath, "logo_vw.png")),
      logoAudi: toBase64(path.join(assetsPath, "logo_audi.png")),
      logoSeat: toBase64(path.join(assetsPath, "logo_seat.png")),
      logoSkoda: toBase64(path.join(assetsPath, "logo_skoda.png")),
      logoPorsche: toBase64(path.join(assetsPath, "logo_porsche.png")),
      logoVwU: toBase64(path.join(assetsPath, "logo_vw_dost.png")),
    };

    const gridTemplate = TABLE_COLUMNS.map((col) => col.width).join(" ");

    const htmlContent = `
<!DOCTYPE html>
<html lang="pl">
<head>
    <meta charset="UTF-8">
    <style>
        @import url('https://fonts.googleapis.com/css2?family=Source+Sans+3:wght@400;600;700;900&display=swap');
        :root { --primary-red: #e20613; --table-border: #8a8a8a; }
        body { margin: 0; padding: 0; background-color: #ffffff; font-family: "Source Sans 3", sans-serif; -webkit-print-color-adjust: exact; }
        .document-wrapper { display: flex; flex-direction: column; min-height: 26.6cm; width: 100%; }
        .grid-row, .keep-together, .block-group, .signature-block, .krd-promo-box { break-inside: avoid; page-break-inside: avoid; }
        .flex-spacer { flex-grow: 1; }
        .page-header { display: flex; justify-content: space-between; align-items: flex-start; margin-bottom: 20px; }
        .img-krd-stamp { width: 250px; border: 2px solid var(--primary-red); border-radius: 10px; }
        .img-krotoski-main { width: 180px; }
        .date-line { font-size: 11pt; margin-top: 5px; text-align: right; }
        .recipient-section { display: flex; justify-content: flex-end; margin: 20px 0; }
        .recipient-address { width: 45%; font-size: 11pt; line-height: 1.4; }
        .recipient-address p { margin: 0; }
        .title-section { text-align: center; margin: 20px 0; }
        .title-section h1 { font-size: 18pt; font-weight: 700; margin: 0; }
        .title-section h3 { color: var(--primary-red); font-size: 10pt; font-weight: 600; margin: 2px 0; }
        .intro-text { font-size: 10.5pt; line-height: 1.5; text-align: justify; }
        .deadline-highlight { color: var(--primary-red); text-align: center; font-size: 11pt; margin: 15px 0; }
        .grid-table-container { margin: 10px 0; }
        .grid-header { display: grid; grid-template-columns: ${gridTemplate}; background-color: #f2f2f2; border: 1px solid var(--table-border); font-weight: 700; font-size: 9pt; }
        .grid-header > div { padding: 8px 4px; border-right: 1px solid var(--table-border); display: flex; align-items: center; justify-content: center; }
        .grid-row { display: grid; grid-template-columns: ${gridTemplate}; border: 1px solid var(--table-border); border-top: none; font-size: 9pt; }
        .grid-row > div { padding: 6px 8px; border-right: 1px solid var(--table-border); display: flex; align-items: center; }
        .grid-header div:last-child, .grid-row div:last-child { border-right: none; }
        .col-nr { font-weight: 600; text-align: left; font-size: 8.5pt; }
        .col-center { justify-content: center; }
        .grid-total-row { text-align: right; font-weight: 700; font-size: 12pt; margin: 10px 0; }
        .payment-info { font-size: 10.5pt; line-height: 1.4; text-align: justify; margin: 10px 0; }
        .company-info-bold { text-align: center; font-weight: 700; margin: 5px 0; }
        .account-number-large { display: block; text-align: center; font-weight: 900; font-size: 13pt; text-decoration: underline; }
        .legal-warning-container { font-size: 10.5pt; line-height: 1.4; margin-top: 15px; }
        .impact-list { padding-left: 20px; margin: 5px 0; list-style-position: inside; }
        .impact-list li { margin-bottom: 3px; font-size: 10.5pt; list-style-type: disc; }
        .krd-promo-box { display: flex; justify-content: center; margin: 20px 0; }
        .img-krd-stamp--large { width: 320px; border: 2px solid var(--primary-red); border-radius: 10px; }
        .signature-block { margin-left: 60%; text-align: center; margin-top: 20px; }
        .brands-footer { border-top: 1px solid #000; padding-top: 10px; display: flex; justify-content: space-between; align-items: center; width: 100%; margin-top: 20px; }
        .footer-brand-img { height: 25px; filter: grayscale(1); opacity: 0.8; }
    </style>
</head>
<body>
    <div class="document-wrapper">
        <header class="page-header">
            <img src="${images.logoKrd}" class="img-krd-stamp">
            <div>
                <img src="${images.logoKrotoski}" class="img-krotoski-main">
                <div class="date-line">Łódź, dnia ${formattedDate}</div>
            </div>
        </header>

        <section class="recipient-section">
            <div class="recipient-address">
                <p><strong>${firstItem.NAZWA_KONTRAHENTA_SLOWNIK}</strong></p>
                <p>${fullStreet}</p>
                <p>${fullCity}</p>
                ${firstItem.KONTR_NIP ? `<p>NIP: ${firstItem.KONTR_NIP}</p>` : ""}
            </div>
        </section>

        <section class="title-section">
            <h1>OSTATECZNE PRZEDSĄDOWE WEZWANIE DO ZAPŁATY</h1>
            <h3>z ostrzeżeniem o możliwości wpisania dłużnika do</h3>
            <h3>Krajowego Rejestru Długów Biura Informacji Gospodarczej S.A.</h3>
        </section>

        <section class="intro-text">
            <p>Wzywamy Państwa do zapłaty roszczenia w wysokości <strong>${formattedTotal}</strong> z tytułu nieopłaconych faktur wyszczególnionych w poniższej tabeli, wraz z <strong>odsetkami za opóźnienie</strong> i rekompensatą za <strong>koszty dochodzenia należności</strong>, zgodnie z art. 10 ust. 1 pkt. 1 ustawy o przeciwdziałaniu nadmiernym opóźnieniom w transakcjach handlowych,</p>
            <p class="deadline-highlight">w nieprzekraczalnym <span style='text-decoration: underline; font-weight: 700;'>terminie 3 dni</span> od daty otrzymania niniejszego pisma.</p>
        </section>

        <section class="grid-table-container">
            <div class="grid-header">
                ${TABLE_COLUMNS.map((col) => `<div>${col.label}</div>`).join("")}
            </div>
            ${settlements
              .map(
                (item) => `
                <div class="grid-row">
                    ${TABLE_COLUMNS.map(
                      (col) => `
                        <div class="${col.id === "doc_nr" ? "col-nr" : "col-center"}">
                            ${item[col.id]}
                        </div>
                    `
                    ).join("")}
                </div>
            `
              )
              .join("")}
        </section>

        <div class="keep-together">
            <div class="grid-total-row">Łącznie do zapłaty: ${formattedTotal}</div>
            <section class="payment-info">
                <p>Kwotę nieuregulowanej należności z tytułu niezapłaconych faktur <strong><u>wraz z kwotą odsetek za opóźnienie oraz rekompensatą za koszty dochodzenia należności</u></strong>, należy uiścić na następujący rachunek bankowy Spółki:</p>
                <p class="company-info-bold">Krotoski sp. z o.o., ul. Niciarniana 51/53, 92-320 Łódź</p>
                <span class="account-number-large">${firstItem.FAKT_BANK_KONTO || "28 1140 1124 0000 3020 3800 1042"}</span>
            </section>
        </div>

        <section class="legal-warning-container">
            <div class="block-group">
                <p>Brak zapłaty wskazanych kwot w powyższym terminie, spowoduje <strong><u>skierowanie sprawy na drogę postępowania sądowego</u></strong>, co będzie się wiązać z <strong><u>dodatkowymi, znacznymi kosztami.</u></strong></p>
            </div>
            <div class="block-group">
                <p>Ponadto spowoduje <strong><u>przekazanie informacji</u></strong> o Państwa <strong><u>zadłużeniu do REJESTRU DŁUŻNIKÓW KRD</u></strong> na podstawie ustawy z dnia 9 kwietnia 2010 r. o udostępnianiu informacji gospodarczych i wymianie danych gospodarczych (Dz.U. Nr 81, poz. 530 ze zm.).</p>
            </div>
            <div class="block-group">
                <p>Wpis o Państwa zadłużeniu w <strong>Krajowym Rejestrze Długów BIG S.A</strong> znacząco utrudni bądź uniemożliwi:</p>
                <ul class="impact-list">
                    <li>uzyskanie kredytów i pożyczek bankowych oraz innych usług i produktów bankowych...</li>
                    <li>dokonywanie zakupów na raty,</li>
                    <li>zawieranie umów cywilnoprawnych takich jak np. umowy najmu,</li>
                    <li>podpisanie lub przedłużenie umowy na: telefon komórkowy, dostęp do Internetu, dostawy prądu, gazu i wielu innych.</li>
                </ul>
            </div>
        </section>

        <div class="keep-together">
            <p>Jednocześnie informujemy, iż <strong><u>wyłącznie całkowita spłata zadłużenia</u></strong> spowoduje usunięcie informacji z Krajowego Rejestru Długów Biura Informacji Gospodarczej S.A.</p>
            <section class="krd-promo-box">
                <img src="${images.logoKrd}" class="img-krd-stamp--large">
            </section>
            <p>Jeżeli płatność została uregulowana przed otrzymaniem niniejszego pisma, prosimy uznać je za niebyłe i przesłać potwierdzenie przelewu na e-mail: <a href="mailto:windykacja@krotoski.com">windykacja@krotoski.com</a></p>
            <section class="signature-block">
                <p><strong>Z poważaniem</strong></p>
                <p>Dział Nadzoru i Kontroli Należności</p>
            </section>
        </div>

        <div class="flex-spacer"></div>

        <footer class="brands-footer">
            <div><img src="${images.logoKrotoski}" class="img-krotoski-main"></div>
            <div style="display: flex; gap: 15px;">
                <img src="${images.logoVw}" class="footer-brand-img">
                <img src="${images.logoAudi}" class="footer-brand-img">
                <img src="${images.logoSeat}" class="footer-brand-img">
                <img src="${images.logoSkoda}" class="footer-brand-img">
                <img src="${images.logoPorsche}" class="footer-brand-img">
                <img src="${images.logoVwU}" class="footer-brand-img">
            </div>
        </footer>
    </div>
</body>
</html>`;

    await page.setContent(htmlContent, { waitUntil: "networkidle0" });

    const pdfBuffer = await page.pdf({
      format: "A4",
      printBackground: true,
      margin: { top: "1.5cm", right: "1.5cm", bottom: "1.5cm", left: "1.5cm" },
    });

    await browser.close();
    return pdfBuffer;
  } catch (error) {
    console.error("Błąd generowania PDF:", error);
  }
};

module.exports = { generateDebtNoticePdf };
