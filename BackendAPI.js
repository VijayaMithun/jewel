
const express = require('express');
const mysql = require('mysql2');
const app = express();
const port = 3000;

app.use(express.json());

const db = mysql.createConnection({
    host: 'mysql-2c62b989-jewel12.i.aivencloud.com',
    port: 14140,
    user: 'avnadmin',
    password: 'AVNS_ODIU8fd4YW0l2furFAE',
    database: 'jewellery',
    ssl: { rejectUnauthorized: false }
});

db.connect((err) => {
    if (err) {
        throw err;
    }
    console.log('MySQL connected...');

});

// Helper to generate next ID
function getNextId(table, column, prefix, callback) {
    // Sort by length first to handle D1, D2, D10 correctly
    let sql = `SELECT ${column} FROM ${table} ORDER BY LENGTH(${column}) DESC, ${column} DESC LIMIT 1`;
    db.query(sql, (err, results) => {
        if (err) return callback(err);
        if (results.length === 0) {
            return callback(null, prefix + "1");
        }
        let lastId = results[0][column]; // e.g., "D10"
        if (!lastId) return callback(null, prefix + "1");

        let numPart = lastId.replace(prefix, ""); // "10"
        let nextNum = parseInt(numPart) + 1; // 11
        callback(null, prefix + nextNum);
    });
}


app.post('/add_dse', (req, res) => {
    getNextId('dse', 'did', 'D', (err, nextId) => {
        if (err) { console.error(err); res.status(500).send('Error generating ID'); return; }

        let dse = {
            did: nextId,
            dsename: req.body.dsename,
            mobile: req.body.mobile,
            email: req.body.email,
            openbalance: req.body.openbalance,
            totalbal: req.body.totalbal
        };
        let sql = 'INSERT INTO dse SET ?';
        db.query(sql, dse, (err, result) => {
            if (err) {
                console.error(err);
                res.status(500).send('Error inserting data');
                return;
            }
            res.send('DSE added...');
        });
    });
});

app.post('/add_user', (req, res) => {
    let loginname = req.body.loginname;
    if (!loginname) {
        return res.status(400).send('Login name is required');
    }

    db.query('SELECT * FROM User WHERE loginname = ?', [loginname], (err, results) => {
        if (err) { console.error(err); res.status(500).send('Error checking user'); return; }
        if (results.length > 0) {
            return res.status(409).send('Login name already exists');
        }

        getNextId('User', 'userid', 'USR', (err, nextId) => {
            if (err) { console.error(err); res.status(500).send('Error generating ID'); return; }

            let user = {
                userid: nextId, // Auto-generated ID
                username: req.body.username,
                loginname: req.body.loginname,
                password: req.body.password,
                mobile: req.body.mobile,
                email: req.body.email,
                Role: req.body.Role || 'User' // Default to User if not provided
            };
            let sql = 'INSERT INTO User SET ?';
            db.query(sql, user, (err, result) => {
                if (err) {
                    console.error(err);
                    res.status(500).send('Error inserting user: ' + err.message);
                    return;
                }
                res.send('User added successfully');
            });
        });
    });
});

app.post('/delete_user', (req, res) => {
    let userid = req.body.userid;
    if (!userid) {
        return res.status(400).send('Missing userid');
    }

    db.query('SELECT * FROM User WHERE userid = ?', [userid], (err, results) => {
        if (err) { console.error(err); res.status(500).send('Error finding user'); return; }
        if (results.length === 0) { res.status(404).send('User not found'); return; }

        let item = results[0];

        // Trash Fields
        let trashFields = {
            field1: String(item.userid),
            field2: item.username,
            field3: item.loginname,
            field4: item.mobile,
            field5: item.email,
            field6: item.Role
        };

        addToTrash('User', userid, trashFields, 'API', db, (err) => {
            if (err) console.error("Error adding to Trash:", err);

            let sql = 'DELETE FROM User WHERE userid = ?';
            db.query(sql, [userid], (err, result) => {
                if (err) {
                    console.error(err);
                    res.status(500).send('Error deleting user');
                    return;
                }
                res.send('User deleted successfully');
            });
        });
    });
});


app.get('/view_users', (req, res) => {
    let sql = 'SELECT * FROM User';
    db.query(sql, (err, results) => {
        if (err) {
            console.error(err);
            res.status(500).send('Error fetching users');
            return;
        }
        res.json(results);
    });
});

app.post('/update_password', (req, res) => {
    let loginName = req.body.loginname;
    let newPassword = req.body.password;

    if (!loginName || !newPassword) {
        return res.status(400).send('Missing loginname or password');
    }

    let sql = 'UPDATE User SET password = ? WHERE loginname = ?';
    db.query(sql, [newPassword, loginName], (err, result) => {
        if (err) {
            console.error(err);
            res.status(500).send('Error updating password');
            return;
        }
        if (result.affectedRows === 0) {
            res.status(404).send('User not found');
            return;
        }
        res.send('Password updated successfully');
    });
});


app.post('/login', (req, res) => {
    console.log("Login request received:", req.body);
    let loginname = req.body.loginname;
    let password = req.body.password;

    if (!loginname || !password) {
        console.log("Missing loginname or password");
        return res.status(400).send('Login name and password are required');
    }

    let sql = 'SELECT * FROM User WHERE loginname = ? AND password = ?';
    db.query(sql, [loginname, password], (err, results) => {
        if (err) {
            console.error("Database error during login:", err);
            return res.status(500).send('Error checking user credentials');
        }
        console.log("Login query results:", results);
        if (results.length > 0) {
            console.log("Login successful for:", loginname);
            res.json(results[0]);
        } else {
            console.log("Login failed: Invalid credentials for", loginname);
            res.status(401).send('Invalid credentials');
        }
    });
});

// ID Configuration Map
const ID_CONFIG = {
    'sale': { table: 'sales', column: 'invno', prefix: 'S' },
    'stock': { table: 'stock', column: 'stockid', prefix: 'K' },
    'inventory': { table: 'inventory', column: 'inventid', prefix: 'V' },
    'purchase': { table: 'purchase', column: 'purchaseid', prefix: 'P' },
    'puremc': { table: 'puremc', column: 'pureid', prefix: 'M' },
    'payment': { table: 'payment', column: 'payid', prefix: 'Y' },
    'retailer_payment': { table: 'retailerpayment', column: 'payid', prefix: 'L' },
    'expenses': { table: 'expenses', column: 'exid', prefix: 'E' },
    'petrol': { table: 'petrolexpenses', column: 'petid', prefix: 'F' },
    'User': { table: 'User', column: 'userid', prefix: 'USR' }
};

// Generic Endpoint for Next ID
app.get('/get_next_id', (req, res) => {
    const type = req.query.type;
    const config = ID_CONFIG[type];

    if (!config) {
        return res.status(400).json({ error: 'Invalid type' });
    }

    const { table, column, prefix } = config;

    // Find the last ID that starts with the given prefix
    // We order by length first to handle numeric sorting (e.g. S10 > S2) correctly if using simple string sort
    let sql = `SELECT ${column} as id FROM ${table} WHERE ${column} LIKE '${prefix}%' ORDER BY LENGTH(${column}) DESC, ${column} DESC LIMIT 1`;

    db.query(sql, (err, results) => {
        if (err) {
            console.error(err);
            res.status(500).json({ error: 'Error fetching next ID' });
            return;
        }

        let nextId = prefix + "1"; // Default if no record found

        if (results.length > 0) {
            let lastId = results[0].id;
            // Extract the numeric part
            let numPart = lastId.substring(prefix.length);
            if (!isNaN(numPart)) {
                let nextNum = parseInt(numPart) + 1;
                nextId = prefix + nextNum;
            }
        }
        res.json({ nextId: nextId });
    });
});

app.get('/view_dse', (req, res) => {
    let sql = 'SELECT * FROM dse';
    db.query(sql, (err, results) => {
        if (err) {
            res.status(500).send('Error fetching data');
            return;
        }
        res.json(results);
    });
});

app.post('/delete_dse', (req, res) => {
    console.log('Received delete_dse request. Body:', req.body);
    let did = req.body.did;
    if (!did) {
        console.error('Missing did in request');
        res.status(400).send('Missing did');
        return;
    }
    // 1. Fetch record
    db.query('SELECT * FROM dse WHERE did = ?', [did], (err, results) => {
        if (err) {
            console.error('Error fetching DSE:', err);
            res.status(500).send('Error finding dse record');
            return;
        }
        if (results.length === 0) {
            console.error('DSE Record not found for did:', did);
            res.status(404).send('Record not found');
            return;
        }

        let item = results[0];
        console.log('Found DSE item:', item);

        // 2. Add to Trash
        // Field Mapping: field1: did, field2: dsename, field3: mobile, field4: email, field5: openbalance, field6: totalbal
        let trashFields = {
            field1: String(item.did),
            field2: item.dsename,
            field3: item.mobile,
            field4: item.email,
            field5: String(item.openbalance),
            field6: String(item.totalbal)
        };

        addToTrash('Dse', did, trashFields, 'API', db, (err) => {
            if (err) console.error("Error adding to trash:", err); // Log but continue delete

            // 3. Delete
            let sql = 'DELETE FROM dse WHERE did = ?';
            db.query(sql, [did], (err, result) => {
                if (err) {
                    console.error('Error deleting DSE from DB:', err);
                    res.status(500).send('Error deleting dse: ' + err.message);
                    return;
                }
                console.log('DSE deleted successfully');
                res.send('DSE deleted successfully');
            });
        });
    });
});

app.post('/add_category', (req, res) => {
    getNextId('category', 'cid', 'C', (err, nextId) => {
        if (err) { console.error(err); res.status(500).send('Error generating ID'); return; }

        let category = {
            cid: nextId,
            categoryname: req.body.categoryname || req.body.categoryName
        };
        let sql = 'INSERT INTO category SET ?';
        db.query(sql, category, (err, result) => {
            if (err) {
                console.error(err);
                res.status(500).send('Error inserting category');
                return;
            }
            res.send('Category added...');
        });
    });
});

app.get('/view_category', (req, res) => {
    let sql = 'SELECT * FROM category';
    db.query(sql, (err, results) => {
        if (err) {
            console.error(err);
            res.status(500).send('Error fetching categories');
            return;
        }
        res.json(results);
    });
});

app.post('/delete_category', (req, res) => {
    let cid = req.body.cid;
    // 1. Fetch record
    db.query('SELECT * FROM category WHERE cid = ?', [cid], (err, results) => {
        if (err) { console.error(err); res.status(500).send('Error finding category'); return; }
        if (results.length === 0) { res.status(404).send('Category not found'); return; }

        let item = results[0];
        // 2. Add to Trash
        // Field Mapping: field1: cid, field2: categoryname
        let trashFields = {
            field1: String(item.cid),
            field2: item.categoryname
        };

        addToTrash('Category', cid, trashFields, 'API', db, (err) => {
            if (err) console.error("Error adding to Trash:", err);

            // 3. Delete
            let sql = 'DELETE FROM category WHERE cid = ?';
            db.query(sql, [cid], (err, result) => {
                if (err) {
                    console.error(err);
                    res.status(500).send('Error deleting category');
                    return;
                }
                res.send('Category deleted successfully');
            });
        });
    });
});

app.post('/add_retailer', (req, res) => {
    getNextId('retailer', 'rid', 'R', (err, nextId) => {
        if (err) { console.error(err); res.status(500).send('Error generating ID'); return; }

        let retailer = {
            rid: nextId,
            dsename: req.body.dsename,
            retailername: req.body.retailername,
            mobile: req.body.mobile,
            location: req.body.location,
            district: req.body.district,
            openbalance: req.body.openbalance
        };
        let sql = 'INSERT INTO retailer SET ?';
        db.query(sql, retailer, (err, result) => {
            if (err) {
                console.error(err);
                res.status(500).send('Error inserting retailer');
                return;
            }
            res.send('Retailer added...');
        });
    });
});

app.post('/delete_retailer', (req, res) => {
    let retailername = req.body.retailername;
    db.query('SELECT * FROM retailer WHERE retailername = ?', [retailername], (err, results) => {
        if (err) { console.error(err); res.status(500).send('Error finding retailer'); return; }
        if (results.length === 0) { res.status(404).send('Retailer not found'); return; }

        let item = results[0]; // Take first match

        // Trash Fields
        let trashFields = {
            field1: item.dsename,
            field2: item.retailername,
            field3: item.mobile,
            field4: item.location,
            field5: item.district,
            field6: String(item.openbalance)
        };

        // Use retailername as ID for Trash record if real ID hidden
        addToTrash('Retailer', 0, trashFields, 'API', db, (err) => {
            if (err) console.error("Error adding to Trash:", err);

            let sql = 'DELETE FROM retailer WHERE retailername = ?';
            db.query(sql, [retailername], (err, result) => {
                if (err) {
                    console.error(err);
                    res.status(500).send('Error deleting retailer');
                    return;
                }
                res.send('Retailer deleted successfully');
            });
        });
    });
});

app.get('/view_retailer', (req, res) => {
    let sql = 'SELECT * FROM retailer';
    db.query(sql, (err, results) => {
        if (err) {
            console.error(err);
            res.status(500).send('Error fetching retailers');
            return;
        }
        res.json(results);
    });
});

app.get('/view_retailer_by_dse', (req, res) => {
    let dsename = req.query.dsename;
    if (!dsename) {
        return res.status(400).send('Missing dsename parameter');
    }
    let sql = 'SELECT * FROM retailer WHERE dsename = ?';
    db.query(sql, [dsename], (err, results) => {
        if (err) {
            console.error(err);
            res.status(500).send('Error fetching retailers');
            return;
        }
        res.json(results);
    });
});

app.post('/add_item', (req, res) => {
    console.log("Received add_item body:", req.body);
    getNextId('item', 'iid', 'I', (err, nextId) => {
        if (err) { console.error(err); res.status(500).send('Error generating ID'); return; }

        let item = {
            iid: nextId,
            itemname: req.body.itemName,
            coverweight: req.body.coverWeight,
            category: req.body.category
        };
        let sql = 'INSERT INTO item SET ?';
        db.query(sql, item, (err, result) => {
            if (err) {
                console.error(err);
                res.status(500).send('Error inserting item');
                return;
            }
            res.send('Item added...');
        });
    });
});

app.get('/view_item', (req, res) => {
    let sql = 'SELECT iid, itemname AS itemName, coverweight AS coverWeight, category FROM item';
    db.query(sql, (err, results) => {
        if (err) {
            console.error(err);
            res.status(500).send('Error fetching items');
            return;
        }
        res.json(results);
    });
});

app.post('/delete_item', (req, res) => {
    let iid = req.body.iid;
    // 1. Fetch record
    db.query('SELECT * FROM item WHERE iid = ?', [iid], (err, results) => {
        if (err) { console.error(err); res.status(500).send('Error finding item'); return; }
        if (results.length === 0) { res.status(404).send('Item not found'); return; }

        let item = results[0];
        // 2. Add to Trash
        // Field Mapping: field1: iid, field2: itemname, field3: coverweight, field4: category
        let trashFields = {
            field1: String(item.iid),
            field2: item.itemname,
            field3: String(item.coverweight),
            field4: item.category
        };

        addToTrash('Item', iid, trashFields, 'API', db, (err) => {
            if (err) console.error("Error adding to Trash:", err);

            // 3. Delete
            let sql = 'DELETE FROM item WHERE iid = ?';
            db.query(sql, [iid], (err, result) => {
                if (err) {
                    console.error(err);
                    res.status(500).send('Error deleting item');
                    return;
                }
                res.send('Item deleted successfully');
            });
        });
    });
});

app.get('/get_last_invoice', (req, res) => {
    let sql = 'SELECT invno FROM sales ORDER BY LENGTH(invno) DESC, invno DESC LIMIT 1';
    db.query(sql, (err, results) => {
        if (err) {
            console.error(err);
            res.status(500).send('Error fetching invoice');
            return;
        }
        if (results.length > 0) {
            res.json({ invno: results[0].invno });
        } else {
            res.json({ invno: null });
        }
    });
});

app.post('/add_sale', (req, res) => {
    // Transaction support is important for sales
    db.beginTransaction((err) => {
        if (err) { throw err; }

        let sale = {
            invno: req.body.invno,
            date: req.body.date,
            dse: req.body.dse,
            retailer: req.body.retailer
        };

        let sqlSale = 'INSERT INTO sales SET ?';
        db.query(sqlSale, sale, (err, result) => {
            if (err) {
                return db.rollback(() => {
                    console.error(err);
                    res.status(500).send('Error inserting sale');
                });
            }

            let items = req.body.saleItems;
            if (items && items.length > 0) {
                let sqlItems = 'INSERT INTO salesitem (invno, item, weight, count, rate, coverwt, total) VALUES ?';
                let values = items.map(item => [req.body.invno, item.product, item.weight, item.count, item.rate, item.cover, item.total]);

                db.query(sqlItems, [values], (err, result) => {
                    if (err) {
                        return db.rollback(() => {
                            console.error(err);
                            res.status(500).send('Error inserting sale items');
                        });
                    }
                    db.commit((err) => {
                        if (err) {
                            return db.rollback(() => {
                                throw err;
                            });
                        }
                        res.send('Sale added successfully');
                    });
                });
            } else {
                db.commit((err) => {
                    if (err) {
                        return db.rollback(() => {
                            throw err;
                        });
                    }
                    res.send('Sale added successfully (no items)');
                });
            }
        });
    });
});

app.get('/view_sales', (req, res) => {
    let sql = 'SELECT * FROM sales';
    db.query(sql, (err, sales) => {
        if (err) {
            console.error(err);
            res.status(500).send('Error fetching sales');
            return;
        }

        // For each sale, fetch items. This is a simple implementation.
        // For better performance in production, use a JOIN and process result.
        // But to match current logic:
        let pending = sales.length;
        if (pending === 0) {
            res.json([]);
            return;
        }

        sales.forEach(sale => {
            let sqlItems = 'SELECT * FROM salesitem WHERE invno = ?';
            db.query(sqlItems, [sale.invno], (err, items) => {
                if (err) {
                    console.error(err);
                    sale.saleItems = [];
                } else {
                    sale.saleItems = items.map(item => ({
                        product: item.item, // Map 'item' column to 'product' field if needed, or keep as is. Android 'SaleItem' uses 'product'.
                        weight: item.weight,
                        count: item.count,
                        rate: item.rate,
                        cover: item.coverwt, // Map 'coverwt' column to 'cover' field
                        total: item.total
                    }));
                }
                pending--;
                if (pending === 0) {
                    res.json(sales);
                }
            });
        });
    });
});

app.post('/delete_sale', (req, res) => {
    console.log("Received delete_sale request. Body:", req.body);
    let invno = req.body.invno;
    if (!invno) {
        console.error("Missing invno in request");
        res.status(400).send("Missing invno");
        return;
    }

    db.beginTransaction((err) => {
        if (err) { console.error("Transaction Error:", err); throw err; }

        // 1. Fetch Header for Trash
        db.query('SELECT * FROM sales WHERE invno = ?', [invno], (err, results) => {
            if (err) {
                return db.rollback(() => {
                    console.error("Error fetching sale:", err);
                    res.status(500).send('Error fetching sale for trash');
                });
            }
            if (results.length === 0) {
                return db.rollback(() => {
                    console.error("Sale not found for invno:", invno);
                    res.status(404).send('Sale not found');
                });
            }

            let sale = results[0];
            console.log("Found sale to delete:", sale);
            // Trash Fields
            let trashFields = {
                field1: String(sale.invno),
                field2: sale.date,
                field3: sale.dse,
                field4: sale.retailer
            };

            // Add to Trash
            addToTrash('Sale', 0, trashFields, 'API', db, (err) => {
                if (err) console.error("Error adding to Trash:", err);

                // 2. Delete items
                let sqlItems = 'DELETE FROM salesitem WHERE invno = ?';
                db.query(sqlItems, [invno], (err, result) => {
                    if (err) {
                        return db.rollback(() => {
                            console.error(err);
                            res.status(500).send('Error deleting sale items');
                        });
                    }

                    // 3. Delete header
                    let sqlSale = 'DELETE FROM sales WHERE invno = ?';
                    db.query(sqlSale, [invno], (err, result) => {
                        if (err) {
                            return db.rollback(() => {
                                console.error(err);
                                res.status(500).send('Error deleting sale');
                            });
                        }
                        db.commit((err) => {
                            if (err) {
                                return db.rollback(() => {
                                    throw err;
                                });
                            }
                            res.send('Sale deleted successfully');
                        });
                    });
                });
            });
        });
    });
});

app.get('/get_last_stock_id', (req, res) => {
    let sql = 'SELECT stockid FROM stock ORDER BY LENGTH(stockid) DESC, stockid DESC LIMIT 1';
    db.query(sql, (err, results) => {
        if (err) {
            console.error(err);
            res.status(500).send('Error fetching stock ID');
            return;
        }
        if (results.length > 0) {
            res.json({ stockid: results[0].stockid });
        } else {
            res.json({ stockid: null });
        }
    });
});

app.post('/add_stock', (req, res) => {
    db.beginTransaction((err) => {
        if (err) { throw err; }

        let stock = {
            stockid: req.body.stockid, // Header uses 'invno' in Java but mapped to 'stockid' via SerializedName or logic
            date: req.body.date,
            dse: req.body.dse
        };

        let sql = 'INSERT INTO stock SET ?';
        db.query(sql, stock, (err, result) => {
            if (err) {
                return db.rollback(() => {
                    console.error(err);
                    res.status(500).send('Error inserting stock');
                });
            }

            let items = req.body.stockItems;
            if (items && items.length > 0) {
                let sqlItems = 'INSERT INTO stocksitem (stockid, item, count, wt, withcoverwt) VALUES ?';
                let values = items.map(item => [req.body.stockid, item.item, item.count, item.wt, item.withcoverwt]);

                db.query(sqlItems, [values], (err, result) => {
                    if (err) {
                        return db.rollback(() => {
                            console.error(err);
                            res.status(500).send('Error inserting stock items');
                        });
                    }
                    db.commit((err) => {
                        if (err) {
                            return db.rollback(() => {
                                throw err;
                            });
                        }
                        res.send('Stock added successfully');
                    });
                });
            } else {
                db.commit((err) => {
                    if (err) {
                        return db.rollback(() => {
                            throw err;
                        });
                    }
                    res.send('Stock added successfully');
                });
            }
        });
    });
});

app.get('/view_stock', (req, res) => {
    let sql = 'SELECT * FROM stock';
    db.query(sql, (err, stocks) => {
        if (err) {
            console.error(err);
            res.status(500).send('Error fetching stocks');
            return;
        }

        let pending = stocks.length;
        if (pending === 0) {
            res.json([]);
            return;
        }

        stocks.forEach(stock => {
            let sqlItems = 'SELECT * FROM stocksitem WHERE stockid = ?';
            db.query(sqlItems, [stock.stockid], (err, items) => {
                if (err) {
                    console.error(err);
                    stock.stockItems = [];
                } else {
                    stock.stockItems = items; // Columns match usage (item, count, wt, withcoverwt)
                }
                pending--;
                if (pending === 0) {
                    res.json(stocks);
                }
            });
        });
    });
});

app.post('/delete_stock', (req, res) => {
    let stockid = req.body.stockid;
    if (!stockid) {
        res.status(400).send("Missing stockid");
        return;
    }

    db.beginTransaction((err) => {
        if (err) { throw err; }

        // 1. Fetch for Trash
        db.query('SELECT * FROM stock WHERE stockid = ?', [stockid], (err, results) => {
            if (err) {
                return db.rollback(() => {
                    console.error("Error fetching stock:", err);
                    res.status(500).send('Error fetching stock for trash');
                });
            }
            if (results.length === 0) {
                return db.rollback(() => {
                    res.status(404).send('Stock not found');
                });
            }

            let item = results[0];
            let trashFields = {
                field1: String(item.stockid),
                field2: item.date,
                field3: item.dse
            };

            addToTrash('Stock', 0, trashFields, 'API', db, (err) => {
                if (err) console.error("Error adding to Trash:", err);

                // 2. Delete Items
                let sqlItems = 'DELETE FROM stocksitem WHERE stockid = ?';
                db.query(sqlItems, [stockid], (err, result) => {
                    if (err) {
                        return db.rollback(() => {
                            console.error(err);
                            res.status(500).send('Error deleting stock items');
                        });
                    }

                    // 3. Delete Header
                    let sqlStock = 'DELETE FROM stock WHERE stockid = ?';
                    db.query(sqlStock, [stockid], (err, result) => {
                        if (err) {
                            return db.rollback(() => {
                                console.error(err);
                                res.status(500).send('Error deleting stock');
                            });
                        }
                        db.commit((err) => {
                            if (err) {
                                return db.rollback(() => {
                                    throw err;
                                });
                            }
                            res.send('Stock deleted successfully');
                        });
                    });
                });
            });
        });
    });
});

app.get('/get_last_inventory_id', (req, res) => {
    let sql = 'SELECT inventid FROM inventory ORDER BY LENGTH(inventid) DESC, inventid DESC LIMIT 1';
    db.query(sql, (err, results) => {
        if (err) {
            console.error(err);
            res.status(500).send('Error fetching inventory ID');
            return;
        }
        if (results.length > 0) {
            res.json({ inventid: results[0].inventid });
        } else {
            res.json({ inventid: null });
        }
    });
});

app.post('/add_inventory', (req, res) => {
    db.beginTransaction((err) => {
        if (err) { throw err; }

        let inventory = {
            inventid: req.body.inventid,
            date: req.body.date,
            dse: req.body.dse
        };

        let sql = 'INSERT INTO inventory SET ?';
        db.query(sql, inventory, (err, result) => {
            if (err) {
                return db.rollback(() => {
                    console.error(err);
                    res.status(500).send('Error inserting inventory');
                });
            }

            let items = req.body.inventoryItems;
            if (items && items.length > 0) {
                // Mapping: product -> item, count -> count, cover -> wt, withcover -> withcoverwt
                let sqlItems = 'INSERT INTO inventoryitem (inventid, item, count, wt, withcoverwt) VALUES ?';
                let values = items.map(item => [req.body.inventid, item.item, item.count, item.wt, item.withcoverwt]);

                db.query(sqlItems, [values], (err, result) => {
                    if (err) {
                        return db.rollback(() => {
                            console.error(err);
                            res.status(500).send('Error inserting inventory items');
                        });
                    }
                    db.commit((err) => {
                        if (err) {
                            return db.rollback(() => {
                                throw err;
                            });
                        }
                        res.send('Inventory added successfully');
                    });
                });
            } else {
                db.commit((err) => {
                    if (err) {
                        return db.rollback(() => {
                            throw err;
                        });
                    }
                    res.send('Inventory added successfully');
                });
            }
        });
    });
});

app.get('/view_inventory', (req, res) => {
    let sql = 'SELECT * FROM inventory';
    db.query(sql, (err, inventories) => {
        if (err) {
            console.error(err);
            res.status(500).send('Error fetching inventories');
            return;
        }

        let pending = inventories.length;
        if (pending === 0) {
            res.json([]);
            return;
        }

        inventories.forEach(inv => {
            let sqlItems = 'SELECT * FROM inventoryitem WHERE inventid = ?';
            db.query(sqlItems, [inv.inventid], (err, items) => {
                if (err) {
                    console.error(err);
                    inv.inventoryItems = [];
                } else {
                    // DB columns: item, count, wt, withcoverwt
                    // JSON expected by Android (based on mapping plan): item, count, wt, withcoverwt
                    inv.inventoryItems = items;
                }
                pending--;
                if (pending === 0) {
                    res.json(inventories);
                }
            });
        });
    });
});

app.post('/delete_inventory', (req, res) => {
    let inventid = req.body.inventid;
    if (!inventid) {
        res.status(400).send("Missing inventid");
        return;
    }

    db.beginTransaction((err) => {
        if (err) { throw err; }

        // 1. Fetch record for Trash
        db.query('SELECT * FROM inventory WHERE inventid = ?', [inventid], (err, results) => {
            if (err) {
                return db.rollback(() => {
                    console.error("Error fetching inventory:", err);
                    res.status(500).send('Error fetching inventory for trash');
                });
            }
            if (results.length === 0) {
                return db.rollback(() => {
                    res.status(404).send('Inventory not found');
                });
            }

            let item = results[0];
            // Trash Fields
            // Field Mapping: field1: inventid, field2: date, field3: dse
            let trashFields = {
                field1: String(item.inventid),
                field2: item.date,
                field3: item.dse
            };

            addToTrash('Inventory', 0, trashFields, 'API', db, (err) => {
                if (err) console.error("Error adding to Trash:", err);

                // 2. Delete Items
                let sqlItems = 'DELETE FROM inventoryitem WHERE inventid = ?';
                db.query(sqlItems, [inventid], (err, result) => {
                    if (err) {
                        return db.rollback(() => {
                            console.error(err);
                            res.status(500).send('Error deleting inventory items');
                        });
                    }

                    // 3. Delete Header
                    let sqlInventory = 'DELETE FROM inventory WHERE inventid = ?';
                    db.query(sqlInventory, [inventid], (err, result) => {
                        if (err) {
                            return db.rollback(() => {
                                console.error(err);
                                res.status(500).send('Error deleting inventory');
                            });
                        }
                        db.commit((err) => {
                            if (err) {
                                return db.rollback(() => {
                                    throw err;
                                });
                            }
                            res.send('Inventory deleted successfully');
                        });
                    });
                });
            });
        });
    });
});

app.get('/get_last_purchase_id', (req, res) => {
    let sql = 'SELECT purchaseid FROM purchase ORDER BY LENGTH(purchaseid) DESC, purchaseid DESC LIMIT 1';
    db.query(sql, (err, results) => {
        if (err) {
            console.error(err);
            res.status(500).send('Error fetching purchase ID');
            return;
        }
        if (results.length > 0) {
            res.json({ purchaseid: results[0].purchaseid });
        } else {
            res.json({ purchaseid: null });
        }
    });
});

app.post('/add_purchase', (req, res) => {
    db.beginTransaction((err) => {
        if (err) { throw err; }

        let purchase = {
            purchaseid: req.body.purchaseid,
            date: req.body.date,
            party: req.body.party
        };

        let sql = 'INSERT INTO purchase SET ?';
        db.query(sql, purchase, (err, result) => {
            if (err) {
                return db.rollback(() => {
                    console.error(err);
                    res.status(500).send('Error inserting purchase');
                });
            }

            let items = req.body.purchaseItems;
            if (items && items.length > 0) {
                let sqlItems = 'INSERT INTO purchaseitem (purchaseid, item, count, wt, withcoverwt) VALUES ?';
                let values = items.map(item => [req.body.purchaseid, item.item, item.count, item.wt, item.withcoverwt]);

                db.query(sqlItems, [values], (err, result) => {
                    if (err) {
                        return db.rollback(() => {
                            console.error(err);
                            res.status(500).send('Error inserting purchase items');
                        });
                    }
                    db.commit((err) => {
                        if (err) {
                            return db.rollback(() => {
                                throw err;
                            });
                        }
                        res.send('Purchase added successfully');
                    });
                });
            } else {
                db.commit((err) => {
                    if (err) {
                        return db.rollback(() => {
                            throw err;
                        });
                    }
                    res.send('Purchase added successfully');
                });
            }
        });
    });
});

app.get('/view_purchase', (req, res) => {
    let sql = 'SELECT * FROM purchase';
    db.query(sql, (err, purchases) => {
        if (err) {
            console.error(err);
            res.status(500).send('Error fetching purchases');
            return;
        }

        let pending = purchases.length;
        if (pending === 0) {
            res.json([]);
            return;
        }

        purchases.forEach(pur => {
            let sqlItems = 'SELECT * FROM purchaseitem WHERE purchaseid = ?';
            db.query(sqlItems, [pur.purchaseid], (err, items) => {
                if (err) {
                    console.error(err);
                    pur.purchaseItems = [];
                } else {
                    pur.purchaseItems = items;
                }
                pending--;
                if (pending === 0) {
                    res.json(purchases);
                }
            });
        });
    });
});

app.post('/delete_purchase', (req, res) => {
    let purchaseid = req.body.purchaseid;
    if (!purchaseid) {
        res.status(400).send("Missing purchaseid");
        return;
    }

    db.beginTransaction((err) => {
        if (err) { throw err; }

        // 1. Fetch record for Trash
        db.query('SELECT * FROM purchase WHERE purchaseid = ?', [purchaseid], (err, results) => {
            if (err) {
                return db.rollback(() => {
                    console.error("Error fetching purchase:", err);
                    res.status(500).send('Error fetching purchase for trash');
                });
            }
            if (results.length === 0) {
                return db.rollback(() => {
                    res.status(404).send('Purchase not found');
                });
            }

            let item = results[0];
            // Trash Fields
            // Field Mapping: field1: purchaseid, field2: date, field3: party
            let trashFields = {
                field1: String(item.purchaseid),
                field2: item.date,
                field3: item.party
            };

            addToTrash('Purchase', 0, trashFields, 'API', db, (err) => {
                if (err) console.error("Error adding to Trash:", err);

                // 2. Delete Items
                let sqlItems = 'DELETE FROM purchaseitem WHERE purchaseid = ?';
                db.query(sqlItems, [purchaseid], (err, result) => {
                    if (err) {
                        return db.rollback(() => {
                            console.error(err);
                            res.status(500).send('Error deleting purchase items');
                        });
                    }

                    // 3. Delete Header
                    let sqlPurchase = 'DELETE FROM purchase WHERE purchaseid = ?';
                    db.query(sqlPurchase, [purchaseid], (err, result) => {
                        if (err) {
                            return db.rollback(() => {
                                console.error(err);
                                res.status(500).send('Error deleting purchase');
                            });
                        }
                        db.commit((err) => {
                            if (err) {
                                return db.rollback(() => {
                                    throw err;
                                });
                            }
                            res.send('Purchase deleted successfully');
                        });
                    });
                });
            });
        });
    });
});

app.get('/get_last_puremc_id', (req, res) => {
    let sql = 'SELECT pureid FROM puremc ORDER BY LENGTH(pureid) DESC, pureid DESC LIMIT 1';
    db.query(sql, (err, results) => {
        if (err) {
            console.error(err);
            res.status(500).send('Error fetching PureMc ID');
            return;
        }
        if (results.length > 0) {
            res.json({ pureid: results[0].pureid });
        } else {
            res.json({ pureid: null });
        }
    });
});

app.post('/add_puremc', (req, res) => {
    db.beginTransaction((err) => {
        if (err) { throw err; }

        let puremc = {
            pureid: req.body.pureid,
            date: req.body.date,
            dsename: req.body.dsename,
            retailername: req.body.retailername
        };

        let sql = 'INSERT INTO puremc SET ?';
        db.query(sql, puremc, (err, result) => {
            if (err) {
                return db.rollback(() => {
                    console.error(err);
                    res.status(500).send('Error inserting puremc');
                });
            }

            let items = req.body.pureMcItems;
            if (items && items.length > 0) {
                // Mapping: pureid, item, weight, count, percent, mc
                let sqlItems = 'INSERT INTO puremcitem (pureid, item, weight, count, percent, mc) VALUES ?';
                let values = items.map(item => [req.body.pureid, item.item, item.weight, item.count, item.percent, item.mc]);

                db.query(sqlItems, [values], (err, result) => {
                    if (err) {
                        return db.rollback(() => {
                            console.error(err);
                            res.status(500).send('Error inserting puremc items');
                        });
                    }
                    db.commit((err) => {
                        if (err) {
                            return db.rollback(() => {
                                throw err;
                            });
                        }
                        res.send('PureMc added successfully');
                    });
                });
            } else {
                db.commit((err) => {
                    if (err) {
                        return db.rollback(() => {
                            throw err;
                        });
                    }
                    res.send('PureMc added successfully');
                });
            }
        });
    });
});

app.get('/view_puremc', (req, res) => {
    let sql = 'SELECT * FROM puremc';
    db.query(sql, (err, puremcs) => {
        if (err) {
            console.error(err);
            res.status(500).send('Error fetching puremcs');
            return;
        }

        let pending = puremcs.length;
        if (pending === 0) {
            res.json([]);
            return;
        }

        puremcs.forEach(pmc => {
            let sqlItems = 'SELECT * FROM puremcitem WHERE pureid = ?';
            db.query(sqlItems, [pmc.pureid], (err, items) => {
                if (err) {
                    console.error(err);
                    pmc.pureMcItems = [];
                } else {
                    // Map DB 'percent' to 'percentage' if needed or rely on GSON alias
                    pmc.pureMcItems = items;
                }
                pending--;
                if (pending === 0) {
                    res.json(puremcs);
                }
            });
        });
    });
});

app.post('/delete_puremc', (req, res) => {
    let pureid = req.body.pureid;
    if (!pureid) {
        res.status(400).send("Missing pureid");
        return;
    }

    db.beginTransaction((err) => {
        if (err) { throw err; }

        // 1. Fetch record for Trash
        db.query('SELECT * FROM puremc WHERE pureid = ?', [pureid], (err, results) => {
            if (err) {
                return db.rollback(() => {
                    console.error("Error fetching puremc:", err);
                    res.status(500).send('Error fetching puremc for trash');
                });
            }
            if (results.length === 0) {
                return db.rollback(() => {
                    res.status(404).send('PureMc not found');
                });
            }

            let item = results[0];
            // Trash Fields
            // Field Mapping: field1: pureid, field2: date, field3: dsename, field4: retailername
            let trashFields = {
                field1: String(item.pureid),
                field2: item.date,
                field3: item.dsename,
                field4: item.retailername
            };

            addToTrash('PureMc', 0, trashFields, 'API', db, (err) => {
                if (err) console.error("Error adding to Trash:", err);

                // 2. Delete Items
                let sqlItems = 'DELETE FROM puremcitem WHERE pureid = ?';
                db.query(sqlItems, [pureid], (err, result) => {
                    if (err) {
                        return db.rollback(() => {
                            console.error(err);
                            res.status(500).send('Error deleting puremc items');
                        });
                    }

                    // 3. Delete Header
                    let sqlPureMc = 'DELETE FROM puremc WHERE pureid = ?';
                    db.query(sqlPureMc, [pureid], (err, result) => {
                        if (err) {
                            return db.rollback(() => {
                                console.error(err);
                                res.status(500).send('Error deleting puremc');
                            });
                        }
                        db.commit((err) => {
                            if (err) {
                                return db.rollback(() => {
                                    throw err;
                                });
                            }
                            res.send('PureMc deleted successfully');
                        });
                    });
                });
            });
        });
    });
});

app.get('/get_last_payment_id', (req, res) => {
    let sql = 'SELECT payid FROM payment ORDER BY LENGTH(payid) DESC, payid DESC LIMIT 1';
    db.query(sql, (err, results) => {
        if (err) {
            console.error(err);
            res.status(500).send('Error fetching payment ID');
            return;
        }
        if (results.length > 0) {
            res.json({ payid: results[0].payid });
        } else {
            res.json({ payid: null });
        }
    });
});

app.post('/add_payment', (req, res) => {
    db.beginTransaction((err) => {
        if (err) { throw err; }

        let payment = {
            payid: req.body.payid,
            date: req.body.date,
            time: req.body.time,
            dsename: req.body.dsename,
            mode: req.body.mode,
            amount: req.body.amount,
            description: req.body.description
        };

        let sql = 'INSERT INTO payment SET ?';
        db.query(sql, payment, (err, result) => {
            if (err) {
                return db.rollback(() => {
                    console.error(err);
                    res.status(500).send('Error inserting payment');
                });
            }

            // Update DSE Total Balance
            let sqlUpdateDse = 'UPDATE dse SET totalbal = totalbal + ? WHERE dsename = ?';
            db.query(sqlUpdateDse, [payment.amount, payment.dsename], (err, result) => {
                if (err) {
                    return db.rollback(() => {
                        console.error(err);
                        res.status(500).send('Error updating DSE balance');
                    });
                }
                db.commit((err) => {
                    if (err) {
                        return db.rollback(() => {
                            throw err;
                        });
                    }
                    res.send('Payment added and balance updated successfully');
                });
            });
        });
    });
});

app.get('/view_payment', (req, res) => {
    let sql = 'SELECT * FROM payment';
    db.query(sql, (err, results) => {
        if (err) {
            console.error(err);
            res.status(500).send('Error fetching payments');
            return;
        }
        res.json(results);
    });
});

app.post('/delete_payment', (req, res) => {
    let payid = req.body.payid;
    if (!payid) {
        res.status(400).send("Missing payid");
        return;
    }

    db.beginTransaction((err) => {
        if (err) { throw err; }

        // 1. Fetch record for Trash
        db.query('SELECT * FROM payment WHERE payid = ?', [payid], (err, results) => {
            if (err) {
                return db.rollback(() => {
                    console.error("Error fetching payment:", err);
                    res.status(500).send('Error fetching payment for trash');
                });
            }
            if (results.length === 0) {
                return db.rollback(() => {
                    res.status(404).send('Payment not found');
                });
            }

            let item = results[0];
            // Trash Fields
            // Field Mapping: field1: payid, field2: date, field3: dsename, field4: mode, field5: amount, field6: description
            let trashFields = {
                field1: String(item.payid),
                field2: item.date,
                field3: item.dsename,
                field4: item.mode,
                field5: String(item.amount),
                field6: item.description
            };

            addToTrash('Payment', 0, trashFields, 'API', db, (err) => {
                if (err) console.error("Error adding to Trash:", err);

                // 2. Delete Record
                let sql = 'DELETE FROM payment WHERE payid = ?';
                db.query(sql, [payid], (err, result) => {
                    if (err) {
                        return db.rollback(() => {
                            console.error(err);
                            res.status(500).send('Error deleting payment');
                        });
                    }
                    db.commit((err) => {
                        if (err) {
                            return db.rollback(() => {
                                throw err;
                            });
                        }
                        res.send('Payment deleted successfully');
                    });
                });
            });
        });
    });
});

app.get('/get_last_retailer_payment_id', (req, res) => {
    let sql = 'SELECT payid FROM retailerpayment ORDER BY LENGTH(payid) DESC, payid DESC LIMIT 1';
    db.query(sql, (err, results) => {
        if (err) {
            console.error(err);
            res.status(500).send('Error fetching retailer payment ID');
            return;
        }
        if (results.length > 0) {
            res.json({ payid: results[0].payid });
        } else {
            res.json({ payid: null });
        }
    });
});

app.post('/add_retailer_payment', (req, res) => {
    let payment = {
        payid: req.body.payid,
        date: req.body.date,
        time: req.body.time,
        dsename: req.body.dsename,
        retailername: req.body.retailername,
        mode: req.body.mode,
        amount: req.body.amount,
        description: req.body.description
    };

    let sql = 'INSERT INTO retailerpayment SET ?';
    db.query(sql, payment, (err, result) => {
        if (err) {
            console.error(err);
            res.status(500).send('Error inserting retailer payment');
            return;
        }
        res.send('Retailer Payment added successfully');
    });
});

app.get('/view_retailer_payment', (req, res) => {
    let sql = 'SELECT * FROM retailerpayment';
    db.query(sql, (err, results) => {
        if (err) {
            console.error(err);
            res.status(500).send('Error fetching retailer payments');
            return;
        }
        res.json(results);
    });
});

app.post('/delete_retailer_payment', (req, res) => {
    let payid = req.body.payid;
    if (!payid) {
        res.status(400).send("Missing payid");
        return;
    }

    db.beginTransaction((err) => {
        if (err) { throw err; }

        // 1. Fetch record for Trash
        db.query('SELECT * FROM retailerpayment WHERE payid = ?', [payid], (err, results) => {
            if (err) {
                return db.rollback(() => {
                    console.error("Error fetching retailer payment:", err);
                    res.status(500).send('Error fetching retailer payment for trash');
                });
            }
            if (results.length === 0) {
                return db.rollback(() => {
                    res.status(404).send('Retailer Payment not found');
                });
            }

            let item = results[0];
            // Trash Fields
            // Field Mapping: field1: payid, field2: date, field3: retailername, field4: dsename, field5: mode, field6: amount, field7: description
            let trashFields = {
                field1: String(item.payid),
                field2: item.date,
                field3: item.retailername,
                field4: item.dsename,
                field5: item.mode,
                field6: String(item.amount),
                field7: item.description
            };

            addToTrash('RetailerPayment', 0, trashFields, 'API', db, (err) => {
                if (err) console.error("Error adding to Trash:", err);

                // 2. Delete Record
                let sql = 'DELETE FROM retailerpayment WHERE payid = ?';
                db.query(sql, [payid], (err, result) => {
                    if (err) {
                        return db.rollback(() => {
                            console.error(err);
                            res.status(500).send('Error deleting retailer payment');
                        });
                    }
                    db.commit((err) => {
                        if (err) {
                            return db.rollback(() => {
                                throw err;
                            });
                        }
                        res.send('Retailer Payment deleted successfully');
                    });
                });
            });
        });
    });
});

app.get('/get_last_expense_id', (req, res) => {
    let sql = 'SELECT exid FROM expenses ORDER BY LENGTH(exid) DESC, exid DESC LIMIT 1';
    db.query(sql, (err, results) => {
        if (err) {
            console.error(err);
            res.status(500).send('Error fetching expense ID');
            return;
        }
        if (results.length > 0) {
            res.json({ exid: results[0].exid });
        } else {
            res.json({ exid: null });
        }
    });
});

app.post('/add_expense', (req, res) => {
    let expense = {
        exid: req.body.exid,
        date: req.body.date,
        time: req.body.time,
        particulars: req.body.particulars,
        amount: req.body.amount,
        description: req.body.description
    };

    let sql = 'INSERT INTO expenses SET ?';
    db.query(sql, expense, (err, result) => {
        if (err) {
            console.error(err);
            res.status(500).send('Error inserting expense');
            return;
        }
        res.send('Expense added successfully');
    });
});

app.get('/view_expense', (req, res) => {
    let sql = 'SELECT * FROM expenses';
    db.query(sql, (err, results) => {
        if (err) {
            console.error(err);
            res.status(500).send('Error fetching expenses');
            return;
        }
        res.json(results);
    });
});

app.post('/delete_expense', (req, res) => {
    let exid = req.body.exid;
    if (!exid) {
        res.status(400).send("Missing exid");
        return;
    }

    db.beginTransaction((err) => {
        if (err) { throw err; }

        // 1. Fetch record for Trash
        db.query('SELECT * FROM expenses WHERE exid = ?', [exid], (err, results) => {
            if (err) {
                return db.rollback(() => {
                    console.error("Error fetching expense:", err);
                    res.status(500).send('Error fetching expense for trash');
                });
            }
            if (results.length === 0) {
                return db.rollback(() => {
                    res.status(404).send('Expense not found');
                });
            }

            let item = results[0];
            // Trash Fields
            // Field Mapping: field1: exid, field2: date, field3: particulars, field4: amount, field5: description, field6: time
            let trashFields = {
                field1: String(item.exid),
                field2: item.date,
                field3: item.particulars,
                field4: String(item.amount),
                field5: item.description,
                field6: item.time
            };

            addToTrash('Expenses', 0, trashFields, 'API', db, (err) => {
                if (err) console.error("Error adding to Trash:", err);

                // 2. Delete Record
                let sql = 'DELETE FROM expenses WHERE exid = ?';
                db.query(sql, [exid], (err, result) => {
                    if (err) {
                        return db.rollback(() => {
                            console.error(err);
                            res.status(500).send('Error deleting expense');
                        });
                    }
                    db.commit((err) => {
                        if (err) {
                            return db.rollback(() => {
                                throw err;
                            });
                        }
                        res.send('Expense deleted successfully');
                    });
                });
            });
        });
    });
});

// Endpoint to fetch particulars for spinner
app.get('/get_particulars', (req, res) => {
    let sql = 'SELECT DISTINCT particulars FROM expenses ORDER BY particulars';
    db.query(sql, (err, results) => {
        if (err) {
            console.error(err);
            res.status(500).send('Error fetching particulars');
            return;
        }
        res.json(results);
    });
});

app.post('/add_particular', (req, res) => {

    res.send('Particular added (logic handled by adding expense)');
});


app.get('/get_last_petrol_id', (req, res) => {
    let sql = 'SELECT petid FROM petrolexpenses ORDER BY LENGTH(petid) DESC, petid DESC LIMIT 1';
    db.query(sql, (err, results) => {
        if (err) {
            console.error(err);
            res.status(500).send('Error fetching Petrol ID');
            return;
        }
        if (results.length > 0) {
            res.json({ petid: results[0].petid });
        } else {
            res.json({ petid: null });
        }
    });
});

app.post('/add_petrol', (req, res) => {
    let petrol = {
        petid: req.body.petid,
        date: req.body.date,
        time: req.body.time,
        dsename: req.body.dsename,
        amount: req.body.amount,
        description: req.body.description
    };

    let sql = 'INSERT INTO petrolexpenses SET ?';
    db.query(sql, petrol, (err, result) => {
        if (err) {
            console.error(err);
            res.status(500).send('Error inserting petrol expense');
            return;
        }
        res.send('Petrol expense added successfully');
    });
});

app.get('/view_petrol', (req, res) => {
    let sql = 'SELECT * FROM petrolexpenses';
    db.query(sql, (err, results) => {
        if (err) {
            console.error(err);
            res.status(500).send('Error fetching petrol expenses');
            return;
        }
        res.json(results);
    });
});

app.post('/delete_petrol', (req, res) => {
    let petid = req.body.petid;
    // 1. Fetch record
    db.query('SELECT * FROM petrolexpenses WHERE petid = ?', [petid], (err, results) => {
        if (err) { console.error(err); res.status(500).send('Error finding petrol record'); return; }
        if (results.length === 0) { res.status(404).send('Record not found'); return; }

        let item = results[0];
        // 2. Add to Trash
        // Field Mapping: field1: petid, field2: date, field3: dsename, field4: amount, field5: description
        let trashFields = {
            field1: item.petid,
            field2: item.date,
            field3: item.dsename,
            field4: String(item.amount),
            field5: item.description
        };

        addToTrash('Petrol', 0, trashFields, 'API', db, (err) => {
            if (err) console.error("Error adding to trash:", err); // Log but continue delete

            // 3. Delete
            let sql = 'DELETE FROM petrolexpenses WHERE petid = ?';
            db.query(sql, [petid], (err, result) => {
                if (err) {
                    console.error(err);
                    res.status(500).send('Error deleting petrol expense');
                    return;
                }
                res.send('Petrol expense deleted successfully');
            });
        });
    });
});

// Helper to add record to trash
function addToTrash(tableName, recordId, fields, deletedBy, dbConnection, callback) {
    let sql = 'INSERT INTO TrashTable (tableName, recordId, field1, field2, field3, field4, field5, field6, field7, deletedBy, deletedAt) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, NOW())';
    let params = [
        tableName,
        recordId || 0,
        fields.field1 || null,
        fields.field2 || null,
        fields.field3 || null,
        fields.field4 || null,
        fields.field5 || null,
        fields.field6 || null,
        fields.field7 || null,
        deletedBy || 'API'
    ];
    // Use provided connection or global db
    (dbConnection || db).query(sql, params, (err, result) => {
        if (callback) callback(err, result);
    });
}

// Trash Endpoints
app.get('/get_trash_tables', (req, res) => {
    let sql = 'SELECT DISTINCT tableName FROM TrashTable';
    db.query(sql, (err, results) => {
        if (err) {
            console.error(err);
            res.status(500).send('Error fetching trash tables');
            return;
        }
        res.json(results);
    });
});

app.get('/view_trash', (req, res) => {
    let tableName = req.query.tableName;
    let sql = 'SELECT * FROM TrashTable';
    let params = [];
    if (tableName && tableName !== 'All Tables') {
        sql += ' WHERE tableName = ?';
        params.push(tableName);
    }
    db.query(sql, params, (err, results) => {
        if (err) {
            console.error(err);
            res.status(500).send('Error fetching trash records');
            return;
        }
        res.json(results);
    });
});

app.post('/delete_trash', (req, res) => {
    let sql = 'DELETE FROM TrashTable WHERE trashId = ?';
    db.query(sql, [req.body.trashId], (err, result) => {
        if (err) {
            console.error(err);
            res.status(500).send('Error deleting trash record');
            return;
        }
        res.send('Trash record deleted successfully');
    });
});

app.listen(port, () => {
    console.log(`Server started on port ${port}`);
});
