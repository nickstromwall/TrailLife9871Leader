// ============================================================
// Trail Life MN-9871 — Volunteer Signup Apps Script Backend
// Deploy as: Extensions > Apps Script > Deploy > Web App
//   Execute as: Me (your Google account)
//   Who has access: Anyone
// After deploy, copy the web app URL into both HTML files
//   (replace 'YOUR_APPS_SCRIPT_URL_HERE')
// ============================================================

// ---- CONFIGURATION ----------------------------------------
const SPREADSHEET_ID   = '1hn2GYbDh67ZWmsVAUXSiB8FG_S4auqYyj1etggv0LvQ';
const SHEET_NAME_ADULT = 'Adult Roles';
const SHEET_NAME_YOUTH = 'Youth Roles';
const SHEET_NAME_LOG   = 'Signups Log';

// Adult role IDs (must match id fields in the HTML)
const ADULT_ROLE_IDS = [
  // Committee
  'troopmaster',
  'asst-troopmaster',
  'committee-chair',
  'chaplain',
  'chaplain-asst-woodlands',
  'chaplain-asst-navads',
  'treasurer',
  'assistant-treasurer',
  // Program Leaders
  'woodlands-ranger',
  'asst-woodlands-ranger',
  'navigator-trail-master',
  'asst-navigator-trail-master',
  'adventurer-advisor',
  'asst-adventurer-advisor',
  // Trail Guides
  'trail-guide-fox',
  'trail-guide-hawk',
  'trail-guide-mountain-lion',
  'trail-guide-navigator',
  'trail-guide-adventurer',
  // Support
  'registrar',
  'outdoor-activities-chair',
  'onboarding-lead',
  'communications-chair',
  'equipment-master',
  'camping-chair',
  'advancement-chair',
  'snack-coordinator',
  'scholarship-chair',
  'fundraising-chair',
  'public-relations',
  'worship-leader',
  'safety-officer',
  'points-manager',
  'parent-advancement-coordinator',
  'materials-manager',
  'tshirt-manager',
  'camping-coordinator',
  'fitness-challenge-coordinator',
  'scripture-memory-coordinator',
  'technology-chair',
  'registration-desk-lead',
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
  const type = e.parameter.type || 'adult';
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
    const data = JSON.parse(e.postData.contents);
    if (data.action === 'signup') {
      recordSignup(data);
    }
  } catch (err) {
    // Swallow errors — no-cors POST won't see the response anyway
  }
  return ContentService
    .createTextOutput(JSON.stringify({ ok: true }))
    .setMimeType(ContentService.MimeType.JSON);
}

// -----------------------------------------------------------
// getRolesData — reads the role sheet and returns status JSON
// -----------------------------------------------------------
function getRolesData(type) {
  const ss = SpreadsheetApp.openById(SPREADSHEET_ID);
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
  const ss = SpreadsheetApp.openById(SPREADSHEET_ID);
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
  const ss = SpreadsheetApp.openById(SPREADSHEET_ID);

  // --- Adult Roles sheet ---
  let adultSheet = ss.getSheetByName(SHEET_NAME_ADULT);
  if (adultSheet) ss.deleteSheet(adultSheet);
  adultSheet = ss.insertSheet(SHEET_NAME_ADULT);
  adultSheet.appendRow(['Role ID', 'Spots', 'Filled', 'Names']);
  adultSheet.getRange('A1:D1').setFontWeight('bold');

  ADULT_ROLE_IDS.forEach(id => {
    adultSheet.appendRow([id, 1, 0, '']);
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

  Logger.log('Sheets initialized. Adult roles: ' + ADULT_ROLE_IDS.length + ', Youth roles: ' + YOUTH_ROLES.length);
}
