const SHEET_NAME = "posts";
const HEADERS = ["postId", "tags", "like", "cute", "want"];

function doGet(e) {
  const mode = String(e?.parameter?.mode || "");

  if (mode !== "posts") {
    return jsonOutput({
      ok: false,
      error: "Unsupported mode"
    });
  }

  const sheet = getSheet_();
  const rows = getRows_(sheet).map(normalizeRow_);

  return jsonOutput({
    ok: true,
    posts: rows
  });
}

function doPost(e) {
  try {
    const payload = JSON.parse(e?.postData?.contents || "{}");
    const mode = String(payload.mode || "");

    if (mode !== "reaction") {
      return jsonOutput({
        ok: false,
        error: "Unsupported mode"
      });
    }

    const postId = String(payload.postId || "").trim();
    const reactionType = String(payload.reactionType || "").trim();

    if (!postId) {
      return jsonOutput({
        ok: false,
        error: "postId is required"
      });
    }

    if (!["like", "cute", "want"].includes(reactionType)) {
      return jsonOutput({
        ok: false,
        error: "reactionType must be like, cute, or want"
      });
    }

    const lock = LockService.getScriptLock();
    lock.waitLock(10000);

    try {
      const sheet = getSheet_();
      const rowIndex = findRowIndexByPostId_(sheet, postId);

      if (rowIndex === -1) {
        return jsonOutput({
          ok: false,
          error: "postId not found"
        });
      }

      const headerMap = getHeaderMap_(sheet);
      const reactionColumn = headerMap[reactionType];
      const currentValue = Number(sheet.getRange(rowIndex, reactionColumn).getValue() || 0);
      sheet.getRange(rowIndex, reactionColumn).setValue(currentValue + 1);

      const updatedRow = normalizeRow_(getRowObject_(sheet, rowIndex));

      return jsonOutput({
        ok: true,
        post: updatedRow
      });
    } finally {
      lock.releaseLock();
    }
  } catch (error) {
    return jsonOutput({
      ok: false,
      error: error.message
    });
  }
}

function setupSheet() {
  const sheet = getSheet_();
  const existingHeaders = sheet.getRange(1, 1, 1, sheet.getLastColumn() || 1).getValues()[0];

  if (existingHeaders.filter(Boolean).length === 0) {
    sheet.getRange(1, 1, 1, HEADERS.length).setValues([HEADERS]);
    return;
  }

  const missingHeaders = HEADERS.filter((header) => !existingHeaders.includes(header));
  if (missingHeaders.length === 0) {
    return;
  }

  const nextColumn = existingHeaders.filter(Boolean).length + 1;
  sheet
    .getRange(1, nextColumn, 1, missingHeaders.length)
    .setValues([missingHeaders]);
}

function getSheet_() {
  const sheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName(SHEET_NAME);
  if (!sheet) {
    throw new Error(`Sheet "${SHEET_NAME}" not found`);
  }
  return sheet;
}

function getRows_(sheet) {
  const lastRow = sheet.getLastRow();
  const lastColumn = sheet.getLastColumn();

  if (lastRow < 2 || lastColumn < 1) {
    return [];
  }

  const headers = sheet.getRange(1, 1, 1, lastColumn).getValues()[0];
  const values = sheet.getRange(2, 1, lastRow - 1, lastColumn).getValues();

  return values
    .map((row) =>
      headers.reduce((accumulator, header, index) => {
        accumulator[header] = row[index];
        return accumulator;
      }, {})
    )
    .filter((row) => String(row.postId || "").trim());
}

function getHeaderMap_(sheet) {
  const headers = sheet.getRange(1, 1, 1, sheet.getLastColumn()).getValues()[0];
  return headers.reduce((accumulator, header, index) => {
    accumulator[String(header).trim()] = index + 1;
    return accumulator;
  }, {});
}

function findRowIndexByPostId_(sheet, postId) {
  const headerMap = getHeaderMap_(sheet);
  const postIdColumn = headerMap.postId;

  if (!postIdColumn) {
    throw new Error('Column "postId" not found');
  }

  const values = sheet.getRange(2, postIdColumn, Math.max(sheet.getLastRow() - 1, 0), 1).getValues();
  const matchIndex = values.findIndex((row) => String(row[0]).trim() === postId);
  return matchIndex === -1 ? -1 : matchIndex + 2;
}

function getRowObject_(sheet, rowIndex) {
  const lastColumn = sheet.getLastColumn();
  const headers = sheet.getRange(1, 1, 1, lastColumn).getValues()[0];
  const values = sheet.getRange(rowIndex, 1, 1, lastColumn).getValues()[0];

  return headers.reduce((accumulator, header, index) => {
    accumulator[header] = values[index];
    return accumulator;
  }, {});
}

function normalizeRow_(row) {
  const tags = String(row.tags || "")
    .split(/[,\n]/)
    .map((tag) => tag.trim().replace(/^#/, ""))
    .filter(Boolean);

  return {
    postId: String(row.postId || "").trim(),
    tags,
    like: Number(row.like || 0),
    cute: Number(row.cute || 0),
    want: Number(row.want || 0)
  };
}

function jsonOutput(data) {
  return ContentService.createTextOutput(JSON.stringify(data)).setMimeType(
    ContentService.MimeType.JSON
  );
}
