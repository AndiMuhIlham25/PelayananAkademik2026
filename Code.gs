/*
  GOOGLE APPS SCRIPT - BACKEND PENGADUAN FT UNTAD

  FITUR:
  - Simpan pengaduan ke Google Sheets.
  - Mendukung pelapor Mahasiswa, Dosen, Operator Prodi, dan Tenaga Kependidikan.
  - Kode aduan menggunakan identitas pelapor:
    Mahasiswa: Stambuk/NIM
    Dosen: NIDN/NIP
    Operator/Tendik: NIP/ID Pegawai
  - Kirim notifikasi email otomatis ke akademikfatek2025@gmail.com.
  - Jika spreadsheet dibuat dari akun akademikfatek2025@gmail.com, file otomatis ada di Drive email itu.
  - Jika dibuat dari akun lain, share spreadsheet ke akademikfatek2025@gmail.com sebagai Editor.

  CARA DEPLOY:
  1. Login Google dengan email yang ingin jadi pemilik Spreadsheet.
     Disarankan: akademikfatek2025@gmail.com
  2. Buat Google Spreadsheet baru.
  3. Rename tab/sheet menjadi: Aduan
  4. Buka Extensions > Apps Script.
  5. Hapus kode default lalu paste kode ini.
  6. Klik Save.
  7. Deploy > New deployment.
  8. Type: Web app.
  9. Execute as: Me.
  10. Who has access: Anyone.
  11. Klik Deploy dan izinkan akses.
  12. Copy Web app URL ke GOOGLE_SCRIPT_URL di index.html.
*/

const SHEET_NAME = "Aduan";
const NOTIFICATION_EMAIL = "akademikfatek2025@gmail.com";

function doPost(e) {
  let lock;

  try {
    lock = LockService.getScriptLock();
    lock.waitLock(10000);

    const ss = SpreadsheetApp.getActiveSpreadsheet();
    let sheet = ss.getSheetByName(SHEET_NAME);

    if (!sheet) {
      sheet = ss.insertSheet(SHEET_NAME);
    }

    setupHeaderIfNeeded(sheet);

    const data = JSON.parse(e.postData.contents || "{}");
    const now = new Date();

    const identitas = String(data.identitas || "").trim();
    const statusPelapor = String(data.status || "").trim();

    if (!identitas) {
      throw new Error("Identitas pelapor wajib diisi.");
    }

    if (!statusPelapor) {
      throw new Error("Status pelapor wajib dipilih.");
    }

    const kodeAduan = identitas;
    const labelIdentitas = getIdentityLabel(statusPelapor);

    const row = [
      now,
      kodeAduan,
      data.nama || "",
      statusPelapor,
      labelIdentitas,
      identitas,
      data.kontak || "",
      data.prodi || "",
      data.kategori || "",
      data.prioritas || "",
      data.judul || "",
      data.detail || "",
      "Menunggu",
      "",
      data.userAgent || ""
    ];

    sheet.appendRow(row);
    sheet.autoResizeColumns(1, 15);

    const lastRow = sheet.getLastRow();
    applyRowStyle(sheet, lastRow, data.prioritas);

    const spreadsheetUrl = ss.getUrl();

    sendNotificationEmail({
      waktu: now,
      kodeAduan,
      labelIdentitas,
      identitas,
      spreadsheetUrl,
      ...data
    });

    return jsonResponse({
      success: true,
      message: "Aduan berhasil disimpan dan notifikasi email terkirim.",
      kodeAduan: kodeAduan
    });
  } catch (error) {
    return jsonResponse({
      success: false,
      message: error.toString()
    });
  } finally {
    if (lock) {
      try {
        lock.releaseLock();
      } catch (err) {}
    }
  }
}

function doGet(e) {
  try {
    const action = e && e.parameter ? e.parameter.action : "";

    if (action === "list") {
      return jsonResponse(getComplaintData());
    }

    return jsonResponse({
      success: true,
      message: "API Pengaduan FT UNTAD aktif.",
      notificationEmail: NOTIFICATION_EMAIL
    });
  } catch (error) {
    return jsonResponse({
      success: false,
      message: error.toString()
    });
  }
}

function setupHeaderIfNeeded(sheet) {
  const headers = [
    "Timestamp",
    "Kode Aduan / Identitas",
    "Nama Lengkap",
    "Status Pelapor",
    "Jenis Identitas",
    "Nomor Identitas",
    "Kontak WA / Email",
    "Program Studi / Unit",
    "Kategori Aduan",
    "Prioritas",
    "Judul Aduan",
    "Detail Permasalahan",
    "Status Aduan",
    "Catatan Operator",
    "User Agent"
  ];

  const lastRow = sheet.getLastRow();

  if (lastRow === 0) {
    sheet.appendRow(headers);
    sheet.setFrozenRows(1);
    sheet.getRange(1, 1, 1, headers.length).setFontWeight("bold");
    sheet.getRange(1, 1, 1, headers.length).setBackground("#0f172a");
    sheet.getRange(1, 1, 1, headers.length).setFontColor("#ffffff");
    sheet.autoResizeColumns(1, headers.length);
    return;
  }

  const firstCell = sheet.getRange(1, 1).getValue();

  if (firstCell !== "Timestamp") {
    sheet.insertRowBefore(1);
    sheet.getRange(1, 1, 1, headers.length).setValues([headers]);
    sheet.setFrozenRows(1);
    sheet.getRange(1, 1, 1, headers.length).setFontWeight("bold");
    sheet.getRange(1, 1, 1, headers.length).setBackground("#0f172a");
    sheet.getRange(1, 1, 1, headers.length).setFontColor("#ffffff");
    sheet.autoResizeColumns(1, headers.length);
  }
}

function getIdentityLabel(statusPelapor) {
  if (statusPelapor === "Mahasiswa") return "Stambuk / NIM";
  if (statusPelapor === "Dosen") return "NIDN / NIP Dosen";
  if (statusPelapor === "Operator Prodi") return "NIP / ID Operator";
  if (statusPelapor === "Tenaga Kependidikan") return "NIP / ID Pegawai";
  return "Identitas Pelapor";
}

function applyRowStyle(sheet, rowNumber, prioritas) {
  const range = sheet.getRange(rowNumber, 1, 1, 15);

  if (prioritas === "Urgent") {
    range.setBackground("#fee2e2");
  } else if (prioritas === "Tinggi") {
    range.setBackground("#ffedd5");
  } else if (prioritas === "Sedang") {
    range.setBackground("#fef9c3");
  } else {
    range.setBackground("#f8fafc");
  }
}

function sendNotificationEmail(data) {
  const subject = `[Pengaduan Akademik FT UNTAD] ${data.status} - ${data.kategori}`;

  const body = `
Ada pengaduan baru masuk pada Sistem Pengaduan Pelayanan Akademik Fakultas Teknik UNTAD.

DETAIL PENGADUAN
--------------------------------
Waktu              : ${formatDate(data.waktu)}
Kode/Identitas     : ${data.kodeAduan}
Nama Pelapor       : ${data.nama || "-"}
Status Pelapor     : ${data.status || "-"}
Jenis Identitas    : ${data.labelIdentitas || "-"}
Nomor Identitas    : ${data.identitas || "-"}
Kontak             : ${data.kontak || "-"}
Prodi / Unit       : ${data.prodi || "-"}
Kategori           : ${data.kategori || "-"}
Prioritas          : ${data.prioritas || "-"}
Judul Aduan        : ${data.judul || "-"}

DETAIL MASALAH
--------------------------------
${data.detail || "-"}

STATUS AWAL
--------------------------------
Menunggu

Buka Spreadsheet:
${data.spreadsheetUrl}

Catatan:
Silakan tinjau data pengaduan pada spreadsheet, lalu isi kolom "Status Aduan" dan "Catatan Operator".
`;

  MailApp.sendEmail({
    to: NOTIFICATION_EMAIL,
    subject: subject,
    body: body,
    name: "Sistem Pengaduan FT UNTAD"
  });
}

function formatDate(date) {
  return Utilities.formatDate(date, Session.getScriptTimeZone(), "dd/MM/yyyy HH:mm:ss");
}

function jsonResponse(payload) {
  return ContentService
    .createTextOutput(JSON.stringify(payload))
    .setMimeType(ContentService.MimeType.JSON);
}


function getComplaintData() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  let sheet = ss.getSheetByName(SHEET_NAME);

  if (!sheet) {
    sheet = ss.insertSheet(SHEET_NAME);
    setupHeaderIfNeeded(sheet);
  }

  setupHeaderIfNeeded(sheet);

  const lastRow = sheet.getLastRow();
  const lastColumn = sheet.getLastColumn();

  if (lastRow <= 1) {
    return {
      success: true,
      stats: {
        total: 0,
        today: 0,
        wait: 0,
        dosen: 0,
        mahasiswa: 0,
        urgent: 0
      },
      rows: []
    };
  }

  const values = sheet.getRange(2, 1, lastRow - 1, lastColumn).getValues();
  const todayKey = Utilities.formatDate(new Date(), Session.getScriptTimeZone(), "yyyyMMdd");

  const rows = values
    .filter(row => row[0])
    .map(row => {
      return {
        timestamp: row[0] ? row[0].toString() : "",
        kode: row[1] || "",
        nama: row[2] || "",
        status: row[3] || "",
        jenisIdentitas: row[4] || "",
        identitas: row[5] || row[1] || "",
        kontak: row[6] || "",
        prodi: row[7] || "",
        kategori: row[8] || "",
        prioritas: row[9] || "",
        judul: row[10] || "",
        detail: row[11] || "",
        statusAduan: row[12] || "Menunggu",
        catatan: row[13] || ""
      };
    })
    .reverse();

  const stats = {
    total: rows.length,
    today: rows.filter(row => {
      if (!row.timestamp) return false;
      const d = new Date(row.timestamp);
      if (isNaN(d.getTime())) return false;
      const key = Utilities.formatDate(d, Session.getScriptTimeZone(), "yyyyMMdd");
      return key === todayKey;
    }).length,
    wait: rows.filter(row => String(row.statusAduan || "Menunggu").toLowerCase() === "menunggu").length,
    dosen: rows.filter(row => row.status === "Dosen").length,
    mahasiswa: rows.filter(row => row.status === "Mahasiswa").length,
    urgent: rows.filter(row => row.prioritas === "Urgent").length
  };

  return {
    success: true,
    stats: stats,
    rows: rows.slice(0, 50)
  };
}
