// BookGrok data source configuration
// Stage 1: local sample CSVs
// Stage 2: replace with published Google Sheets CSV URLs

const CONFIG = {
  tracksCsvUrl: "samples/tracks_sample.csv",
  sessionsCsvUrl: "samples/sessions_sample.csv"
};

// Stage 2 template (uncomment and fill in SHEET_ID):
// const CONFIG = {
//   tracksCsvUrl: "https://docs.google.com/spreadsheets/d/SHEET_ID/gviz/tq?tqx=out:csv&sheet=tracks",
//   sessionsCsvUrl: "https://docs.google.com/spreadsheets/d/SHEET_ID/gviz/tq?tqx=out:csv&sheet=sessions"
// };
