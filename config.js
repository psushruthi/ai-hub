// Connect the site to your Google Sheet.
//
// 1. In Google Sheets, click Share and set "Anyone with the link" to Viewer.
// 2. Copy the long ID from the sheet's address:
//    https://docs.google.com/spreadsheets/d/THIS_PART_IS_THE_ID/edit
// 3. Paste it between the quotes below, save, and push.
//
// Leave it empty to use the saved copy in the data folder.
window.HUB_CONFIG = {
  SHEET_ID: "",
  // Tab names in the sheet. They must match exactly.
  TABS: ["people", "events", "learn", "resources", "posts", "kpis"]
};
