/*
  =========================================================
  BACKEND GOOGLE APPS SCRIPT
  Pengaduan Pelayanan Sistem Akademik FT UNTAD - V3 Live Sheets
  =========================================================

  Spreadsheet sudah dipasang:
  https://docs.google.com/spreadsheets/d/18V6wvuv5tG8HyC7HwHONAXyYzEyLl_3QVsCs7HIUXJI/edit

  FITUR:
  - Menerima submit pengaduan dari index.html
  - Menyimpan data ke Google Spreadsheet
  - Membuat header Spreadsheet otomatis lewat setupSheet()
  - Status awal otomatis: Menunggu
  - Endpoint GET ?action=list untuk dashboard live
  - Kalau kolom "Status Aduan" di Spreadsheet diganti jadi Selesai,
    website otomatis ikut berubah saat auto-refresh
  - Statistik: total, hari ini, menunggu, selesai, dosen, mahasiswa, urgent
  - Email notifikasi ke admin
  - Email balasan ke pelapor jika kontak berisi email

  CARA PASANG:
  1. Buka Google Apps Script.
  2. Hapus isi Code.gs lama.
  3. Paste semua kode ini.
  4. Save.
  5. Jalankan fungsi setupSheet() sekali.
  6. Deploy > Manage deployments > Edit/pensil.
  7. Pilih Version: New version.
  8. Execute as: Me.
  9. Who has access: Anyone.
  10. Deploy.
*/

const SPREADSHEET_ID = "18V6wvuv5tG8HyC7HwHONAXyYzEyLl_3QVsCs7HIUXJI";
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
    const lastColumn = Math.max(sheet.getLastColumn(), HEADERS.length);
    const currentHeaders = sheet.getRange(1, 1, 1, lastColumn).getValues()[0];

    HEADERS.forEach((header, index) => {
      if (!currentHeaders[index] || String(currentHeaders[index]).trim() !== header) {
        sheet.getRange(1, index + 1).setValue(header);
      }
    });
  }

  sheet.setFrozenRows(1);

  sheet.getRange(1, 1, 1, HEADERS.length)
    .setFontWeight("bold")
    .setBackground("#0f172a")
    .setFontColor("#ffffff");

  sheet.autoResizeColumns(1, HEADERS.length);

  const statusColumn = HEADERS.indexOf("Status Aduan") + 1;
  const priorityColumn = HEADERS.indexOf("Prioritas") + 1;

  if (statusColumn > 0) {
    const statusRule = SpreadsheetApp.newDataValidation()
      .requireValueInList(["Menunggu", "Diproses", "Selesai", "Ditolak"], true)
      .setAllowInvalid(true)
      .build();

    sheet
      .getRange(2, statusColumn, Math.max(sheet.getMaxRows() - 1, 1), 1)
      .setDataValidation(statusRule);
  }

  if (priorityColumn > 0) {
    const priorityRule = SpreadsheetApp.newDataValidation()
      .requireValueInList(["Rendah", "Sedang", "Tinggi", "Urgent"], true)
      .setAllowInvalid(true)
      .build();

    sheet
      .getRange(2, priorityColumn, Math.max(sheet.getMaxRows() - 1, 1), 1)
      .setDataValidation(priorityRule);
  }

  return "Setup selesai. Header dan validasi dropdown sudah dibuat.";
}

function doGet(e) {
  try {
    const action = e && e.parameter && e.parameter.action;

    if (action === "list") {
      const rows = getRows_();

      return jsonResponse_({
        success: true,
        rows: rows,
        stats: getStatsFromRows_(rows),
        serverTime: Utilities.formatDate(new Date(), TIMEZONE, "yyyy-MM-dd HH:mm:ss")
      });
    }

    return jsonResponse_({
      success: true,
      message: "Backend Apps Script aktif. Gunakan ?action=list untuk membaca data.",
      serverTime: Utilities.formatDate(new Date(), TIMEZONE, "yyyy-MM-dd HH:mm:ss")
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
      clean_(data.nama),
      clean_(data.status),
      clean_(data.identitas),
      clean_(data.kontak),
      clean_(data.prodi),
      clean_(data.kategori),
      clean_(data.prioritas),
      clean_(data.judul),
      clean_(data.detail),
      "Menunggu",
      "",
      clean_(data.userAgent)
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
        kodeAduan: value_(item["Kode Aduan"]),
        nama: value_(item["Nama"]),
        status: value_(item["Status"]),
        identitas: value_(item["Identitas"]),
        kontak: value_(item["Kontak"]),
        prodi: value_(item["Prodi"]),
        kategori: value_(item["Kategori"]),
        prioritas: value_(item["Prioritas"]),
        judul: value_(item["Judul"]),
        detail: value_(item["Detail"]),
        statusAduan: value_(item["Status Aduan"]) || "Menunggu",
        catatanOperator: value_(item["Catatan Operator"])
      };
    });
}

function getStatsFromRows_(rows) {
  const todayText = Utilities.formatDate(new Date(), TIMEZONE, "yyyy-MM-dd");

  return {
    total: rows.length,
    today: rows.filter(row => String(row.timestamp || "").startsWith(todayText)).length,
    wait: rows.filter(row => normalize_(row.statusAduan) === "menunggu").length,
    done: rows.filter(row => normalize_(row.statusAduan) === "selesai").length,
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
  const nextNumber = Math.max(sheet.getLastRow(), 1);
  const numberPart = String(nextNumber).padStart(4, "0");

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

function clean_(value) {
  return String(value || "").trim();
}

function value_(value) {
  if (value === null || value === undefined) return "";
  return String(value).trim();
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

Silakan buka Spreadsheet untuk mengubah status menjadi:
- Menunggu
- Diproses
- Selesai
- Ditolak

Catatan operator dapat diisi pada kolom "Catatan Operator".
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
