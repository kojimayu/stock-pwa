
const sqlite3 = require('sqlite3').verbose();
const db = new sqlite3.Database('./test.db');

db.all("PRAGMA table_info(AirConditionerLog)", [], (err, rows) => {
    if (err) {
        throw err;
    }
    console.log(JSON.stringify(rows, null, 2));
});

db.close();
