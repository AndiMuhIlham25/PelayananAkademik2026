/*
  BACKEND GOOGLE APPS SCRIPT
  Pengaduan Pelayanan Sistem Akademik FT UNTAD

  Cara pakai:
  1. Buka https://script.google.com/
  2. Buat project baru
  3. Hapus isi Code.gs
  4. Paste semua kode ini
  5. Isi SPREADSHEET_ID dan ADMIN_EMAIL
  6. Jalankan setupSheet() sekali
  7. Deploy > New deployment > Web app
     - Execute as: Me
     - Who has access: Anyone
  8. Copy URL Web App, lalu tempel ke GOOGLE_SCRIPT_URL di index.html
*/

const SPREADSHEET_ID = "ISI_ID_SPREADSHEET_DI_SINI";
const SHEET_NAME = "Pengaduan";
const ADMIN_EMAIL = "akademikfatek2025@gmail.com";
const TIMEZONE = "Asia/Makassar";

const HEADERS = [
  "Timestamp",
  "Kode Aduan",
  "Nama",
  "Status",
  "Identitas",
  "Kontak",
  "Prodi",
  "Kategori",
  "Prioritas",
  "Judul",
  "Detail",
  "Status Aduan",
  "Catatan Operator",
  "User Agent"
];

function setupSheet() {
  const sheet = getSheet_();

  if (sheet.getLastRow() === 0) {
    sheet.appendRow(HEADERS);
  } else {
    const currentHeaders = sheet
      .getRange(1, 1, 1, Math.max(sheet.getLastColumn(), HEADERS.length))
      .getValues()[0];

    HEADERS.forEach((header, index) => {
      if (!currentHeaders[index]) {
        sheet.getRange(1, index + 1).setValue(header);
      }
    });
  }

  sheet.setFrozenRows(1);
  sheet.autoResizeColumns(1, HEADERS.length);
}

function doGet(e) {
  try {
    const action = e && e.parameter && e.parameter.action;

    if (action === "list") {
      return jsonResponse_({
        success: true,
        rows: getRows_(),
        stats: getStats_()
      });
    }

    return jsonResponse_({
      success: true,
      message: "Backend Apps Script aktif. Gunakan ?action=list untuk membaca data."
    });
  } catch (error) {
    return jsonResponse_({
      success: false,
      message: error.message
    });
  }
}

function doPost(e) {
  try {
    if (!e || !e.postData || !e.postData.contents) {
      throw new Error("Data kosong. Tidak ada payload yang diterima.");
    }

    const data = JSON.parse(e.postData.contents);
    validateData_(data);

    const sheet = getSheet_();

    if (sheet.getLastRow() === 0) {
      setupSheet();
    }

    const kodeAduan = generateKodeAduan_();
    const timestamp = new Date();

    sheet.appendRow([
      timestamp,
      kodeAduan,
      data.nama || "",
      data.status || "",
      data.identitas || "",
      data.kontak || "",
      data.prodi || "",
      data.kategori || "",
      data.prioritas || "",
      data.judul || "",
      data.detail || "",
      "Menunggu",
      "",
      data.userAgent || ""
    ]);

    sendAdminNotification_(data, kodeAduan, timestamp);
    sendUserNotification_(data, kodeAduan);

    return jsonResponse_({
      success: true,
      message: "Aduan berhasil tersimpan.",
      kodeAduan: kodeAduan
    });
  } catch (error) {
    return jsonResponse_({
      success: false,
      message: error.message
    });
  }
}

function getSheet_() {
  if (!SPREADSHEET_ID || SPREADSHEET_ID === "https://docs.google.com/spreadsheets/d/1gDmxitArRVBWxrdYP62iAtVWIr-CWmyY4JnkwEf3wLI/edit?usp=sharing") {
    throw new Error("SPREADSHEET_ID belum diisi di Code.gs.");
  }

  const spreadsheet = SpreadsheetApp.openById(SPREADSHEET_ID);
  let sheet = spreadsheet.getSheetByName(SHEET_NAME);

  if (!sheet) {
    sheet = spreadsheet.insertSheet(SHEET_NAME);
  }

  return sheet;
}

function getRows_() {
  const sheet = getSheet_();

  if (sheet.getLastRow() <= 1) {
    return [];
  }

  const values = sheet.getDataRange().getValues();
  const headers = values[0].map(header => String(header).trim());
  const rows = values.slice(1);

  return rows
    .filter(row => row.some(cell => cell !== "" && cell !== null))
    .reverse()
    .map(row => {
      const item = rowToObject_(headers, row);

      return {
        timestamp: formatDate_(item["Timestamp"]),
        kodeAduan: item["Kode Aduan"] || "",
        nama: item["Nama"] || "",
        status: item["Status"] || "",
        identitas: item["Identitas"] || "",
        kontak: item["Kontak"] || "",
        prodi: item["Prodi"] || "",
        kategori: item["Kategori"] || "",
        prioritas: item["Prioritas"] || "",
        judul: item["Judul"] || "",
        detail: item["Detail"] || "",
        statusAduan: item["Status Aduan"] || "Menunggu",
        catatanOperator: item["Catatan Operator"] || ""
      };
    });
}

function getStats_() {
  const rows = getRows_();
  const todayText = Utilities.formatDate(new Date(), TIMEZONE, "yyyy-MM-dd");

  return {
    total: rows.length,
    today: rows.filter(row => {
      if (!row.timestamp) return false;
      return String(row.timestamp).startsWith(todayText);
    }).length,
    wait: rows.filter(row => normalize_(row.statusAduan) === "menunggu").length,
    dosen: rows.filter(row => normalize_(row.status) === "dosen").length,
    mahasiswa: rows.filter(row => normalize_(row.status) === "mahasiswa").length,
    urgent: rows.filter(row => normalize_(row.prioritas) === "urgent").length
  };
}

function rowToObject_(headers, row) {
  const object = {};

  headers.forEach((header, index) => {
    object[header] = row[index];
  });

  return object;
}

function validateData_(data) {
  const requiredFields = [
    "nama",
    "status",
    "identitas",
    "kontak",
    "prodi",
    "kategori",
    "prioritas",
    "judul",
    "detail"
  ];

  requiredFields.forEach(field => {
    if (!data[field] || String(data[field]).trim() === "") {
      throw new Error(`Field ${field} wajib diisi.`);
    }
  });
}

function generateKodeAduan_() {
  const sheet = getSheet_();
  const datePart = Utilities.formatDate(new Date(), TIMEZONE, "yyyyMMdd");
  const count = Math.max(sheet.getLastRow(), 1);
  const numberPart = String(count).padStart(4, "0");

  return `FT-${datePart}-${numberPart}`;
}

function formatDate_(value) {
  if (!value) return "";

  if (Object.prototype.toString.call(value) === "[object Date]") {
    return Utilities.formatDate(value, TIMEZONE, "yyyy-MM-dd HH:mm:ss");
  }

  return String(value);
}

function normalize_(value) {
  return String(value || "").trim().toLowerCase();
}

function jsonResponse_(data) {
  return ContentService
    .createTextOutput(JSON.stringify(data))
    .setMimeType(ContentService.MimeType.JSON);
}

function sendAdminNotification_(data, kodeAduan, timestamp) {
  if (!ADMIN_EMAIL) return;

  const subject = `[Pengaduan Akademik FT] ${kodeAduan} - ${data.prioritas || "Prioritas"}`;

  const body = `
Ada pengaduan akademik baru.

Kode Aduan: ${kodeAduan}
Waktu: ${Utilities.formatDate(timestamp, TIMEZONE, "yyyy-MM-dd HH:mm:ss")} WITA

Nama: ${data.nama || "-"}
Status Pelapor: ${data.status || "-"}
Identitas: ${data.identitas || "-"}
Kontak: ${data.kontak || "-"}
Prodi/Unit: ${data.prodi || "-"}
Kategori: ${data.kategori || "-"}
Prioritas: ${data.prioritas || "-"}
Judul: ${data.judul || "-"}

Detail:
${data.detail || "-"}

Status awal: Menunggu
`;

  MailApp.sendEmail(ADMIN_EMAIL, subject, body);
}

function sendUserNotification_(data, kodeAduan) {
  const kontak = String(data.kontak || "").trim();

  if (!kontak.includes("@")) return;

  const subject = `[FT UNTAD] Aduan Anda diterima - ${kodeAduan}`;

  const body = `
Yth. ${data.nama || "Pelapor"},

Aduan Anda sudah diterima oleh sistem pelayanan akademik Fakultas Teknik Universitas Tadulako.

Kode Aduan: ${kodeAduan}
Judul Aduan: ${data.judul || "-"}
Status Awal: Menunggu

Mohon simpan kode aduan ini untuk pengecekan atau tindak lanjut.

Terima kasih.
`;

  MailApp.sendEmail(kontak, subject, body);
}
