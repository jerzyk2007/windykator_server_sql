const puppeteer = require("puppeteer");
const fs = require("fs");
const path = require("path");

// --- KONFIGURACJA TREŚCI (JSON) ---
const documentData = {
  titles: {
    main: "OSTATECZNE PRZEDSĄDOWE WEZWANIE DO ZAPŁATY",
    sub1: "z ostrzeżeniem o możliwości wpisania dłużnika do",
    sub2: "Krajowego Rejestru Długów Biura Informacji Gospodarczej S.A.",
  },
  content: {
    // Funkcja intro przyjmuje sformatowaną kwotę
    company:
      "Krotoski Elektromobility sp. z o.o.<br/> Niciarniana 51/53, 92-320 Łódź",
    intro: (amount) =>
      `Wzywamy Państwa do zapłaty roszczenia w wysokości <strong>${amount}</strong> z tytułu nieopłaconych faktur wyszczególnionych w poniższej tabeli, wraz z <strong>odsetkami za opóźnienie</strong> i rekompensatą za <strong>koszty dochodzenia należności</strong>, zgodnie z art. 10 ust. 1 pkt. 1 ustawy o przeciwdziałaniu nadmiernym opóźnieniom w transakcjach handlowych,`,
    deadline:
      "w nieprzekraczalnym <span style='text-decoration: underline; font-weight: 700;'>terminie 3 dni</span> od daty otrzymania niniejszego pisma.",
    total_label: "Łącznie do zapłaty:",
    account_intro:
      "Kwotę nieuregulowanej należności z tytułu niezapłaconych faktur <strong>wraz z kwotą odsetek za opóźnienie oraz rekompensatą za koszty dochodzenia należności</strong>, należy uiścić na następujący rachunek bankowy Spółki:",
    legal_warning:
      "Brak zapłaty wskazanych kwot w powyższym terminie, spowoduje <strong>skierowanie sprawy na drogę postępowania sądowego</strong>, co będzie się wiązać z <strong>dodatkowymi, znacznymi kosztami</strong>.",
    legal_warning1:
      "Ponadto spowoduje <strong>przekazanie informacji</strong> o Państwa <strong>zadłużeniu do REJESTRU DŁUŻNIKÓW KRD</strong> na podstawie ustawy z dnia 9 kwietnia 2010 r. o udostępnianiu informacji gospodarczych i wymianie danych gospodarczych (Dz.U. Nr 81, poz. 530 ze zm.).",
    krd_impact: {
      intro:
        "Wpis o Państwa zadłużeniu w <strong>Krajowym Rejestrze Długów BIG S.A.</strong> znacząco utrudni bądź uniemożliwi:",
      list: [
        "uzyskanie kredytów i pożyczek bankowych oraz innych usług i produktów bankowych, takich jak karty kredytowe czy limit debetowy na koncie osobistym/firmowym;",
        "dokonywanie zakupów na raty;",
        "zawieranie umów cywilnoprawnych takich jak np. umowy najmu;",
        "podpisanie lub przedłużenie umowy na: telefon komórkowy, dostęp do Internetu, dostawy prądu, gazu i wielu innych.",
      ],
    },
    closing_info:
      "Jednocześnie informujemy, iż <strong>wyłącznie całkowita spłata zadłużenia</strong> spowoduje usunięcie informacji z Krajowego Rejestru Długów.",
    final_note: "Potwierdzenie przelewu prosimy przesłać na e-mail: ",
    email_contact: "windykacja@krotoski.com",
  },
  signature: {
    label: "Z poważaniem",
    dept: "Dział Nadzoru i Kontroli Należności",
  },
};

const formatCurrency = (value) => {
  if (value === null || value === undefined) return "0,00 zł";
  const numericValue =
    typeof value === "number"
      ? value
      : Number(value.toString().replace(/\s/g, "").replace(",", "."));
  if (isNaN(numericValue)) return "0,00 zł";

  return (
    numericValue
      .toFixed(2)
      .replace(".", ",")
      .replace(/\d(?=(\d{3})+,)/g, "$& ") + " zł"
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

const generateDebtNoticePdf = async (docData) => {
  try {
    const firstItem = docData[0];
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

    let totalSum = 0;
    docData.forEach((item) => {
      totalSum +=
        (Number(item.AS_DO_ROZLICZENIA) || 0) +
        (Number(item.ODSETKI) || 0) +
        (Number(item.OPLATA_ZA_OPOZNIENIE) || 171.81);
    });

    const formattedTotal = formatCurrency(totalSum);
    const today = new Date();
    const formattedDate =
      today.toLocaleDateString("pl-PL", {
        day: "numeric",
        month: "long",
        year: "numeric",
      }) + " roku";

    const browser = await puppeteer.launch({
      headless: "new",
      args: ["--no-sandbox", "--disable-setuid-sandbox"],
    });
    const page = await browser.newPage();
    const assetsPath = path.join(__dirname, "assets");

    const images = {
      logoKrd: toBase64(path.join(assetsPath, "logo-krd.png")),
      logoKrotoski: toBase64(path.join(assetsPath, "logo-krt.png")),
      logoAll: toBase64(path.join(assetsPath, "logo-marks.png")),
      // logoVw: toBase64(path.join(assetsPath, "logo_vw.png")),
      // logoAudi: toBase64(path.join(assetsPath, "logo_audi.png")),
      // logoSeat: toBase64(path.join(assetsPath, "logo_seat.png")),
      // logoSkoda: toBase64(path.join(assetsPath, "logo_skoda.png")),
      // logoPorsche: toBase64(path.join(assetsPath, "logo_porsche.png")),
      // logoVwU: toBase64(path.join(assetsPath, "logo_vw_dost.png")),
    };

    const htmlContent = `
<!DOCTYPE html>
<html lang="pl">
<head>
    <meta charset="UTF-8">
    <style>
        @import url('https://fonts.googleapis.com/css2?family=Source+Sans+3:wght@400;600;700;900&display=swap');
        :root { --primary-red: #e20613; --table-border: #8a8a8a; }
        * { box-sizing: border-box; }
        
        html, body { height: 100%; margin: 0; padding: 0; background-color: #ffffff; }
        body { font-family: "Source Sans 3", sans-serif; -webkit-print-color-adjust: exact; }
        
        /* 🚀 KLUCZ: position relative pozwala stopce absolute bottom: 0 trzymać się dołu */
        .document-wrapper { 
            position: relative;
            display: block;
            width: 100%;
            /* min-height ustawiane przez JS */
            padding-bottom: 80px; /* Zapas, by treść nie weszła pod stopkę */
        }

        .page-header { display: flex; justify-content: space-between; align-items: flex-start; margin-bottom: 20px; }
        .img-krd-stamp { width: 250px; border: 2px solid var(--primary-red); border-radius: 10px; }
        .img-krotoski-main { width: 150px; }
        .date-line { font-size: 11pt; margin-top: 5px; text-align: right; }
        .recipient-section { display: flex; justify-content: flex-end; margin: 20px 0; }
        .recipient-address { width: 45%; font-size: 11pt; line-height: 1.4; }
        
        .title-section { text-align: center; margin: 15px 0; }
        .title-section h1 { font-size: 14pt; font-weight: 700; margin: 0; }
        .title-section h3 { color: var(--primary-red); font-size: 10pt; font-weight: 600; margin: 2px 0; }
        
        .intro-text { font-size: 10.5pt; line-height: 1.3; text-align: justify; margin: 20px 0; }
        .intro-text--centre {  text-align: center; }
        .intro-text--centre p {margin: 0; padding: 0; }
        .deadline-highlight { color: var(--primary-red); text-align: center; font-size: 11pt; margin: 15px 0; }
        .impact-section {margin-top: 15px; font-size: 10.5pt; line-height: 1.4;}
        .impact-list { margin: 5px 0 15px 0; padding-left: 25px; list-style-type: disc; }
      .impact-list li { margin-bottom: 5px; text-align: justify;}
        table { width: 100%; border-collapse: collapse; margin: 10px 0; table-layout: fixed; }
        thead { display: table-header-group; }
        th { background-color: #f2f2f2; border: 1px solid var(--table-border); padding: 8px 4px; font-weight: 700; font-size: 10.5pt; text-align: center; }
        td { border: 1px solid var(--table-border); padding: 6px 8px; font-size: 10.5pt; vertical-align: middle; }
        
        tbody { break-inside: avoid; page-break-inside: avoid; }
        .col-center { text-align: center; }
        .col-nr { text-align: left; font-weight: 900; font-size: 10.5pt; }

        .grid-total-row { text-align: right; font-weight: 700; font-size: 12pt; margin: 10px 0; }
        .grid-total-row p {text-align: justify}
        .keep-together { break-inside: avoid; page-break-inside: avoid; }

        .final-atomic-block { break-inside: avoid; page-break-inside: avoid; margin-top: 20px; }
        .krd-promo-box { display: flex; justify-content: center; margin: 20px 0; }
        .img-krd-stamp--large { width: 320px; border: 2px solid var(--primary-red); border-radius: 10px; }
        .signature-block { margin-left: 60%; text-align: center; margin-top: 15px; }
      .recipient-address p {margin: 0; padding: 0; line-height: 1.3;  }
        /* 🚀 STOPKA - POSITION ABSOLUTE */
        .brands-footer {
            position: absolute;
            bottom: 0;
            left: 0;
            width: 100%;
            border-top: 1px solid #000;
            display: flex;
            justify-content: space-between;
            align-items: center;
            height: 60px;
            background: white;
        }
        .footer-brand-img { width: 350px; filter: grayscale(1); opacity: 0.8; }
    </style>
</head>
<body>
    <div class="document-wrapper" id="pdf-content">
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
            <h1>${documentData.titles.main}</h1>
            <h3>${documentData.titles.sub1}</h3>
            <h3>${documentData.titles.sub2}</h3>
        </section>

        <section class="intro-text">
            <p>${documentData.content.intro(formattedTotal)}</p>
            <p class="deadline-highlight">${documentData.content.deadline}</p>
        </section>

        <table>
            <thead>
                <tr>
                    <th style="width: 35%">Nr. Dokumentu</th>
                    <th style="width: 13%">Data wystawienia</th>
                    <th style="width: 13%">Termin płatności</th>
                    <th style="width: 13%">Wartość początkowa</th>
                    <th style="width: 13%">Pozostała do zapłaty</th>
                    <th style="width: 13%">Odsetki</th>
                </tr>
            </thead>
            ${docData
              .map((item) => {
                const principal = Number(item.AS_DO_ROZLICZENIA) || 0;
                const interest = Number(item.ODSETKI) || 0;
                const compensation = 171.81;
                let nextDay = "";
                if (item.TERMIN) {
                  const d = new Date(item.TERMIN);
                  d.setDate(d.getDate() + 1);
                  nextDay = d.toISOString().split("T")[0];
                }
                return `
                <tbody>
                    <tr>
                        <td class="col-nr">${item.NUMER_FV}</td>
                        <td class="col-center">${item.DATA_FV}</td>
                        <td class="col-center">${item.TERMIN}</td>
                        <td class="col-center">${formatCurrency(principal)}</td>
                        <td class="col-center">${formatCurrency(principal)}</td>
                        <td class="col-center">${formatCurrency(interest)}</td>
                    </tr>
                    <tr>
                        <td style="font-size: 10.5pt; font-weight: 800;">40 euro zgodnie z art. 10 ust. 1 pkt. 1 ustawy o przeciwdziałaniu nadmiernym opóźnieniom w transakcjach handl.</td>
                        <td class="col-center">${nextDay}</td>
                        <td class="col-center">${nextDay}</td>
                        <td class="col-center">${formatCurrency(compensation)}</td>
                        <td class="col-center">${formatCurrency(compensation)}</td>
                        <td class="col-center"></td>
                    </tr>
                </tbody>`;
              })
              .join("")}
        </table>

        <div class="keep-together">
            <div class="grid-total-row">${documentData.content.total_label} ${formattedTotal}</div>
       </div>

       <section class="intro-text">
            <p>${documentData.content.account_intro}</p>
         </section>

           <section class="intro-text intro-text--centre">
            <p>${documentData.content.company}</p>
            <p style="margin-top: 10px"><strong>${firstItem.FAKT_BANK_KONTO}</strong></p>
         </section>

           <section class="intro-text">
         <p>${documentData.content.legal_warning}</p>
         </section>
           <section class="intro-text">
         <p>${documentData.content.legal_warning1}</p>
         </section>

         <section class="impact-section keep-together">
    <p>${documentData.content.krd_impact.intro}</p>
    <ul class="impact-list">
        ${documentData.content.krd_impact.list.map((item) => `<li>${item}</li>`).join("")}
    </ul>
</section>

 <section class="intro-text">
     <p>${documentData.content.closing_info}</p>
     </section>
        <div class="final-atomic-block">
                    <section class="krd-promo-box">
                <img src="${images.logoKrd}" class="img-krd-stamp--large">
            </section>
            <p>${documentData.content.final_note} <a href="mailto:${documentData.content.email_contact}">${documentData.content.email_contact}</a></p>
            
            <section class="signature-block">
                <p><strong>${documentData.signature.label}</strong></p>
                <p>${documentData.signature.dept}</p>
            </section>
        </div>

        <!-- STOPKA MAREK -->
        <footer class="brands-footer">
            <div><img src="${images.logoKrotoski}" class="img-krotoski-main"></div>
            <div style="display: flex; gap: 12px;">
                <img src="${images.logoAll}" class="footer-brand-img">
           
            </div>
        </footer>
    </div>
</body>
</html>`;

    await page.setContent(htmlContent, { waitUntil: "networkidle0" });

    // 🚀 OSTATECZNA POPRAWKA WYSOKOŚCI (Aby uniknąć 3. strony):
    await page.evaluate(() => {
      const wrapper = document.getElementById("pdf-content");
      const pageHeightMm = 267; // Wysokość obszaru roboczego A4 (297 - marginesy 15-15)

      wrapper.style.height = "auto"; // Reset do pomiaru
      const currentHeightPx = wrapper.offsetHeight;
      const currentHeightMm = currentHeightPx * 0.264583; // px na mm

      const pages = Math.ceil(currentHeightMm / pageHeightMm);
      // Ustawiamy wysokość kontenera na DOKŁADNĄ wielokrotność strony MINUS margines bezpieczeństwa
      // Ustawienie np. 533mm dla 2 stron zamiast 534mm.
      wrapper.style.height = pages * pageHeightMm - 0.5 + "mm";
    });

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
