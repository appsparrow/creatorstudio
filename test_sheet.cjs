const https = require('https');

const sheetId = '1hplAu2wnW1AliTBuZ8ScdHDKNQAxzgGC';
const sheetName = '30-Day Content Calendar';
const url = `https://docs.google.com/spreadsheets/d/${sheetId}/gviz/tq?tqx=out:json&sheet=${encodeURIComponent(sheetName)}`;

https.get(url, (res) => {
  let data = '';
  res.on('data', chunk => { data += chunk; });
  res.on('end', () => {
    try {
      // The response starts with something like `/* O_o */\ngoogle.visualization.Query.setResponse(`
      // We need to extract the JSON object inside the parenthesis.
      const match = data.match(/google\.visualization\.Query\.setResponse\(([\s\S]*)\);/);
      if (match) {
        const json = JSON.parse(match[1]);
        console.log(JSON.stringify(json.table.cols.map(c => c.label), null, 2));
        console.log("Rows count:", json.table.rows.length);
        if (json.table.rows.length > 0) {
          console.log("Example Row:", JSON.stringify(json.table.rows[0].c.map(v => v ? v.v : null), null, 2));
        }
      } else {
        console.log("No match found", data.substring(0, 200));
      }
    } catch (e) {
      console.error("Parse Error:", e);
      console.log("Data:", data.substring(0, 200));
    }
  });
}).on('error', (e) => {
  console.error("Fetch Error:", e);
});
