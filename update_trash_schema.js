const mysql = require('mysql2');

const db = mysql.createConnection({
    host: 'mysql-2c62b989-jewel12.i.aivencloud.com',
    port: 14140,
    user: 'avnadmin',
    password: 'AVNS_ODIU8fd4YW0l2furFAE',
    database: 'jewellery',
    ssl: { rejectUnauthorized: false }
});

db.connect((err) => {
    if (err) throw err;
    console.log('Connected to DB');

    const sql = "ALTER TABLE TrashTable MODIFY COLUMN recordId VARCHAR(50)";

    db.query(sql, (err, result) => {
        if (err) {
            console.error('Error updating TrashTable:', err.message);
        } else {
            console.log('Successfully updated TrashTable.recordId to VARCHAR(50)');
        }
        db.end();
    });
});
