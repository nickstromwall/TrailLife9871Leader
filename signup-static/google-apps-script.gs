// ============================================================
// Trail Life MN-9871 — Volunteer Signup Apps Script Backend
// Deploy as: Extensions > Apps Script > Deploy > Web App
//   Execute as: Me (your Google account)
//   Who has access: Anyone
// After deploy, copy the web app URL into both HTML files
//   (replace 'YOUR_APPS_SCRIPT_URL_HERE')
// ============================================================

// ---- CONFIGURATION ----------------------------------------
// No spreadsheet ID needed: this script must be opened from inside
// the target Sheet via Extensions > Apps Script, so it's container-bound
// to that Sheet. SpreadsheetApp.getActiveSpreadsheet() always returns it.
const SHEET_NAME_ADULT = 'Adult Roles';
const SHEET_NAME_YOUTH = 'Youth Roles';
const SHEET_NAME_LOG   = 'Signups Log';

// Adult roles (id, seat count, optional prefilled names).
// IDs must match the id fields in 2026-2027-Volunteer-Signup-Adults.html.
// Spot counts must match the `spots` field in the HTML for that role.
const ADULT_ROLES = [
  // Committee
  { id: 'troopmaster',                  spots: 1, prefilled: ['Nick Stromwall'] },
  { id: 'asst-troopmaster',             spots: 3 },
  { id: 'committee-chair',              spots: 1 },
  { id: 'chaplain',                     spots: 1 },
  { id: 'chaplain-asst-woodlands',      spots: 1 },
  { id: 'chaplain-asst-navads',         spots: 1 },
  { id: 'treasurer',                    spots: 1 },
  { id: 'assistant-treasurer',          spots: 1 },
  // Program Leaders
  { id: 'woodlands-ranger',             spots: 1 },
  { id: 'asst-woodlands-ranger',        spots: 1 },
  { id: 'navigator-trail-master',       spots: 1 },
  { id: 'asst-navigator-trail-master',  spots: 1 },
  { id: 'adventurer-advisor',           spots: 1 },
  { id: 'asst-adventurer-advisor',      spots: 1 },
  // Trail Guides
  { id: 'trail-guide-fox',              spots: 3 },
  { id: 'trail-guide-hawk',             spots: 3 },
  { id: 'trail-guide-mountain-lion',    spots: 3 },
  { id: 'trail-guide-navigator',        spots: 3 },
  { id: 'trail-guide-adventurer',       spots: 3 },
  // Support
  { id: 'registrar',                    spots: 1 },
  { id: 'outdoor-activities-chair',     spots: 1 },
  { id: 'onboarding-lead',              spots: 1 },
  { id: 'communications-chair',         spots: 1 },
  { id: 'equipment-master',             spots: 1 },
  { id: 'camping-chair',                spots: 1 },
  { id: 'advancement-chair',            spots: 1 },
  { id: 'snack-coordinator',            spots: 1 },
  { id: 'scholarship-chair',            spots: 1 },
  { id: 'fundraising-chair',            spots: 1 },
  { id: 'public-relations',             spots: 1 },
  { id: 'worship-leader',               spots: 1 },
  { id: 'safety-officer',               spots: 1 },
  { id: 'points-manager',               spots: 1 },
  { id: 'parent-advancement-coordinator', spots: 1 },
  { id: 'materials-manager',            spots: 1 },
  { id: 'tshirt-manager',               spots: 1 },
  { id: 'camping-coordinator',          spots: 1 },
  { id: 'fitness-challenge-coordinator', spots: 1 },
  { id: 'scripture-memory-coordinator', spots: 1 },
  { id: 'technology-chair',             spots: 1 },
  { id: 'registration-desk-lead',       spots: 1 },
];

// Youth role IDs with their total seat counts
const YOUTH_ROLES = [
  { id: 'patrol-leader',             spots: 2  },
  { id: 'jr-patrol-leader',          spots: 2  },
  { id: 'scribe',                    spots: 1  },
  { id: 'quartermaster',             spots: 1  },
  { id: 'chaplains-aide',            spots: 2  },
  { id: 'color-guard-commander',     spots: 2  },
  { id: 'color-guard',               spots: 10 },
  { id: 'facility-manager',          spots: 6  },
  { id: 'snack-coordinator',         spots: 2  },
  { id: 'navad-calendar-manager',    spots: 1  },
  { id: 'navad-advancement-manager', spots: 2  },
];

// -----------------------------------------------------------
// doGet — returns current role state as JSON
// Called by: fetchUpdates() in the HTML pages
// URL params: ?action=getRoles&type=adult  OR  &type=youth
// -----------------------------------------------------------
function doGet(e) {
  // When invoked from the Apps Script editor Run button there is no `e`.
  // Default to the adult roles so the function is still useful for ad-hoc testing.
  const type = (e && e.parameter && e.parameter.type) || 'adult';
  const result = getRolesData(type);
  return ContentService
    .createTextOutput(JSON.stringify(result))
    .setMimeType(ContentService.MimeType.JSON);
}

// -----------------------------------------------------------
// doPost — records a new signup
// Body JSON: { action: 'signup', type: 'adult'|'youth', roleId, name, email, phone? }
// -----------------------------------------------------------
function doPost(e) {
  try {
    if (!e || !e.postData || !e.postData.contents) return jsonOk();
    const data = JSON.parse(e.postData.contents);
    if (data.action === 'signup') {
      recordSignup(data);
    }
  } catch (err) {
    // Swallow errors — no-cors POST won't see the response anyway
  }
  return jsonOk();
}

function jsonOk() {
  return ContentService
    .createTextOutput(JSON.stringify({ ok: true }))
    .setMimeType(ContentService.MimeType.JSON);
}

// -----------------------------------------------------------
// getRolesData — reads the role sheet and returns status JSON
// -----------------------------------------------------------
function getRolesData(type) {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const sheetName = type === 'youth' ? SHEET_NAME_YOUTH : SHEET_NAME_ADULT;
  const sheet = ss.getSheetByName(sheetName);
  if (!sheet) return { roles: [] };

  const data = sheet.getDataRange().getValues();
  const roles = [];

  // Skip header row (row index 0)
  for (let i = 1; i < data.length; i++) {
    const row = data[i];
    // Columns: A=roleId, B=spots, C=filled, D=names (comma-separated)
    const roleId  = row[0];
    const spots   = parseInt(row[1]) || 1;
    const filled  = parseInt(row[2]) || 0;
    const names   = row[3] ? String(row[3]).split(',').map(n => n.trim()).filter(Boolean) : [];
    const status  = filled >= spots ? 'filled' : (filled > 0 ? 'partial' : 'open');

    roles.push({ id: roleId, spots, filled, names, status });
  }

  return { roles };
}

// -----------------------------------------------------------
// recordSignup — appends signup to Log sheet and updates role sheet
// -----------------------------------------------------------
function recordSignup(data) {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const type = data.type || 'adult';
  const roleId = data.roleId;
  const name   = data.name || '';
  const email  = data.email || '';
  const phone  = data.phone || '';

  // 1. Log the raw signup
  let logSheet = ss.getSheetByName(SHEET_NAME_LOG);
  if (!logSheet) {
    logSheet = ss.insertSheet(SHEET_NAME_LOG);
    logSheet.appendRow(['Timestamp', 'Type', 'Role ID', 'Name', 'Email', 'Phone']);
  }
  logSheet.appendRow([new Date(), type, roleId, name, email, phone]);

  // 2. Update the role sheet
  const sheetName = type === 'youth' ? SHEET_NAME_YOUTH : SHEET_NAME_ADULT;
  const roleSheet = ss.getSheetByName(sheetName);
  if (!roleSheet) return;

  const roleData = roleSheet.getDataRange().getValues();
  for (let i = 1; i < roleData.length; i++) {
    if (roleData[i][0] === roleId) {
      const spots   = parseInt(roleData[i][1]) || 1;
      const current = parseInt(roleData[i][2]) || 0;
      if (current >= spots) return; // Already full — don't double-count

      // Column C: increment filled count
      roleSheet.getRange(i + 1, 3).setValue(current + 1);

      // Column D: append name
      const existingNames = roleData[i][3] ? String(roleData[i][3]) : '';
      const newNames = existingNames ? existingNames + ', ' + name : name;
      roleSheet.getRange(i + 1, 4).setValue(newNames);
      break;
    }
  }
}

// -----------------------------------------------------------
// initializeSheet — run this ONCE to seed both role sheets
// Run from: Apps Script editor > Run > initializeSheet
// -----------------------------------------------------------
function initializeSheet() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();

  // --- Adult Roles sheet ---
  let adultSheet = ss.getSheetByName(SHEET_NAME_ADULT);
  if (adultSheet) ss.deleteSheet(adultSheet);
  adultSheet = ss.insertSheet(SHEET_NAME_ADULT);
  adultSheet.appendRow(['Role ID', 'Spots', 'Filled', 'Names']);
  adultSheet.getRange('A1:D1').setFontWeight('bold');

  ADULT_ROLES.forEach(r => {
    const prefilled = r.prefilled || [];
    adultSheet.appendRow([r.id, r.spots || 1, prefilled.length, prefilled.join(', ')]);
  });

  // --- Youth Roles sheet ---
  let youthSheet = ss.getSheetByName(SHEET_NAME_YOUTH);
  if (youthSheet) ss.deleteSheet(youthSheet);
  youthSheet = ss.insertSheet(SHEET_NAME_YOUTH);
  youthSheet.appendRow(['Role ID', 'Spots', 'Filled', 'Names']);
  youthSheet.getRange('A1:D1').setFontWeight('bold');

  YOUTH_ROLES.forEach(r => {
    youthSheet.appendRow([r.id, r.spots, 0, '']);
  });

  // --- Signups Log ---
  let logSheet = ss.getSheetByName(SHEET_NAME_LOG);
  if (!logSheet) {
    logSheet = ss.insertSheet(SHEET_NAME_LOG);
    logSheet.appendRow(['Timestamp', 'Type', 'Role ID', 'Name', 'Email', 'Phone']);
    logSheet.getRange('A1:F1').setFontWeight('bold');
  }

  const adultSpots = ADULT_ROLES.reduce((s, r) => s + (r.spots || 1), 0);
  const youthSpots = YOUTH_ROLES.reduce((s, r) => s + (r.spots || 1), 0);
  Logger.log(
    'Sheets initialized. Adult roles: ' + ADULT_ROLES.length + ' (' + adultSpots + ' seats), ' +
    'Youth roles: ' + YOUTH_ROLES.length + ' (' + youthSpots + ' seats).'
  );
}
