// BookGrok data source configuration
// Stage 1: local sample CSVs (absolute paths so /access/ resolves from root)
// Stage 2: replace with published Google Sheets CSV URLs

const CONFIG = {
  tracksCsvUrl: "https://docs.google.com/spreadsheets/d/e/2PACX-1vSKtYmvCbI9Yb88gVgC3HyyBT-C6IfVAtAPY-OaP9jokwkvNpxV_wuOmIRztO080l_Lkf-au4-Cjddc/pub?gid=0&single=true&output=csv",
  sessionsCsvUrl: "https://docs.google.com/spreadsheets/d/e/2PACX-1vSKtYmvCbI9Yb88gVgC3HyyBT-C6IfVAtAPY-OaP9jokwkvNpxV_wuOmIRztO080l_Lkf-au4-Cjddc/pub?gid=668627981&single=true&output=csv",
  featuredCount: 6,  // "Open now" section size; rest go to "Full library"
  requestBookUrl: "https://forms.gle/REPLACE_REQUEST_BOOK_FORM"  // "Request a book" Google Form
};

// Stage 2 template (uncomment, fill SHEET_ID, keep featuredCount + requestBookUrl):
// const CONFIG = {
//   tracksCsvUrl: "https://docs.google.com/spreadsheets/d/SHEET_ID/gviz/tq?tqx=out:csv&sheet=tracks",
//   sessionsCsvUrl: "https://docs.google.com/spreadsheets/d/SHEET_ID/gviz/tq?tqx=out:csv&sheet=sessions",
//   featuredCount: 6,
//   requestBookUrl: "https://forms.gle/REPLACE_REQUEST_BOOK_FORM"
// };
