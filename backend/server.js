require("dotenv").config();

const express = require("express");
const cors = require("cors");
const mysql = require("mysql2");
const path = require("path");

const app = express();


// ======================================================
// MIDDLEWARE
// ======================================================

app.use(cors());
app.use(express.json());


// ======================================================
// FRONTEND PATH
// ======================================================

const frontendPath = path.join(__dirname, "..", "frontend");


// ======================================================
// SERVE FRONTEND FILES
// IMPORTANT:
// index: false prevents Express from automatically opening
// frontend/index.html when visiting "/"
// ======================================================

app.use(
    "/frontend",
    express.static(frontendPath, {
        index: false
    })
);

app.use(
    express.static(frontendPath, {
        index: false
    })
);


// ======================================================
// MYSQL CONFIGURATION
// ======================================================

const DB_HOST =
    process.env.DB_HOST ||
    process.env.MYSQLHOST;

const DB_PORT =
    process.env.DB_PORT ||
    process.env.MYSQLPORT ||
    3306;

const DB_USER =
    process.env.DB_USER ||
    process.env.MYSQLUSER;

const DB_PASSWORD =
    process.env.DB_PASSWORD ||
    process.env.MYSQLPASSWORD;

const DB_NAME =
    process.env.DB_NAME ||
    process.env.MYSQLDATABASE;


// ======================================================
// MYSQL CONNECTION
// ======================================================

const db = mysql.createConnection({

    host: DB_HOST,

    port: Number(DB_PORT),

    user: DB_USER,

    password: DB_PASSWORD,

    database: DB_NAME

});


// ======================================================
// MYSQL CONNECT
// ======================================================

db.connect((err) => {

    if (err) {

        console.log(
            "❌ MySQL connection failed:",
            err.message
        );

        return;
    }

    console.log(
        "================================="
    );

    console.log(
        "✅ MySQL connected successfully!"
    );

    console.log(
        "================================="

    );

});


// ======================================================
// CREATE TABLES IF NOT EXISTS
// ======================================================

function setupTables() {

    const createTablesSQL = `

        CREATE TABLE IF NOT EXISTS restaurant_tables (

            id INT AUTO_INCREMENT PRIMARY KEY,

            table_number INT NOT NULL UNIQUE,

            status VARCHAR(20) DEFAULT 'Available'

        )

    `;


    db.query(
        createTablesSQL,
        (err) => {

            if (err) {

                console.log(
                    "❌ restaurant_tables creation failed:",
                    err.message
                );

                return;
            }


            console.log(
                "✅ restaurant_tables table ready!"
            );


            // --------------------------------------------------
            // INSERT TABLES 1 - 10
            // --------------------------------------------------

            const insertTableSQL = `

                INSERT IGNORE INTO restaurant_tables
                (table_number, status)

                VALUES
                (?, 'Available')

            `;


            for (
                let table = 1;
                table <= 10;
                table++
            ) {

                db.query(
                    insertTableSQL,
                    [table],
                    (err) => {

                        if (err) {

                            console.log(
                                `❌ Table ${table} creation failed:`,
                                err.message
                            );

                        }

                    }
                );

            }


            console.log(
                "✅ Tables 1-10 are ready!"
            );

        }
    );

}


// ======================================================
// HOME PAGE
// IMPORTANT
//
// Render live URL:
//
// https://smart-restaurant-3axh.onrender.com/
//
// This will now open QR TABLE PAGE.
// It will NOT open index.html.
// ======================================================

app.get("/", (req, res) => {

    res.sendFile(
        path.join(
            frontendPath,
            "qr-tables.html"
        )
    );

});


// ======================================================
// PLACE NEW ORDER
// ======================================================

app.post("/api/orders", (req, res) => {

    const {
        table,
        items,
        total
    } = req.body;


    // --------------------------------------------------
    // VALIDATION
    // --------------------------------------------------

    if (
        !table ||
        !Array.isArray(items) ||
        items.length === 0 ||
        total === undefined
    ) {

        return res.status(400).json({

            success: false,

            message:
                "Invalid order data"

        });

    }


    // --------------------------------------------------
    // CHECK TABLE
    // --------------------------------------------------

    const checkTableSQL = `

        SELECT
            table_number,
            status

        FROM restaurant_tables

        WHERE table_number = ?

    `;


    db.query(
        checkTableSQL,
        [table],
        (err, tableResults) => {

            if (err) {

                console.log(
                    "❌ Table check failed:",
                    err.message
                );

                return res.status(500).json({

                    success: false,

                    message:
                        "Could not check table"

                });

            }


            if (tableResults.length === 0) {

                return res.status(404).json({

                    success: false,

                    message:
                        `Table ${table} not found`

                });

            }


            if (
                tableResults[0].status === "Occupied"
            ) {

                return res.status(409).json({

                    success: false,

                    message:
                        `Table ${table} is already occupied`

                });

            }


            // --------------------------------------------------
            // INSERT ORDER
            // --------------------------------------------------

            const insertOrderSQL = `

                INSERT INTO orders
                (
                    table_number,
                    items,
                    total,
                    status,
                    payment_status
                )

                VALUES
                (?, ?, ?, 'Pending', 'Pending')

            `;


            db.query(
                insertOrderSQL,
                [
                    table,
                    JSON.stringify(items),
                    total
                ],
                (err, result) => {

                    if (err) {

                        console.log(
                            "❌ Order save failed:",
                            err.message
                        );

                        return res.status(500).json({

                            success: false,

                            message:
                                "Order could not be saved"

                        });

                    }


                    const orderId =
                        result.insertId;


                    console.log(
                        `✅ Order ${orderId} saved to MySQL!`
                    );


                    // --------------------------------------------------
                    // MAKE TABLE OCCUPIED
                    // --------------------------------------------------

                    const updateTableSQL = `

                        UPDATE restaurant_tables

                        SET status = 'Occupied'

                        WHERE table_number = ?

                    `;


                    db.query(
                        updateTableSQL,
                        [table],
                        (err) => {

                            if (err) {

                                console.log(
                                    "❌ Table status update failed:",
                                    err.message
                                );


                                const deleteOrderSQL = `

                                    DELETE FROM orders

                                    WHERE id = ?

                                `;


                                db.query(
                                    deleteOrderSQL,
                                    [orderId]
                                );


                                return res.status(500).json({

                                    success: false,

                                    message:
                                        "Could not occupy table"

                                });

                            }


                            console.log(
                                `🪑 Table ${table} → Occupied`
                            );


                            return res.json({

                                success: true,

                                message:
                                    "Order saved successfully!",

                                orderId:
                                    orderId

                            });

                        }
                    );

                }
            );

        }
    );

});


// ======================================================
// GET ALL ORDERS
// ======================================================

app.get("/api/orders", (req, res) => {

    const sql = `

        SELECT *

        FROM orders

        ORDER BY created_at DESC

    `;


    db.query(
        sql,
        (err, results) => {

            if (err) {

                console.log(
                    "❌ Failed to get orders:",
                    err.message
                );

                return res.status(500).json({

                    success: false,

                    message:
                        "Could not fetch orders"

                });

            }


            res.json({

                success: true,

                orders: results

            });

        }
    );

});


// ======================================================
// GET ONE ORDER
// ======================================================

app.get("/api/orders/:id", (req, res) => {

    const orderId =
        req.params.id;


    const sql = `

        SELECT *

        FROM orders

        WHERE id = ?

    `;


    db.query(
        sql,
        [orderId],
        (err, results) => {

            if (err) {

                console.log(
                    "❌ Failed to get order:",
                    err.message
                );

                return res.status(500).json({

                    success: false,

                    message:
                        "Could not get order"

                });

            }


            if (results.length === 0) {

                return res.status(404).json({

                    success: false,

                    message:
                        "Order not found"

                });

            }


            res.json({

                success: true,

                order: results[0]

            });

        }
    );

});


// ======================================================
// UPDATE ORDER STATUS
// ======================================================

app.put("/api/orders/:id/status", (req, res) => {

    const orderId =
        req.params.id;

    const { status } =
        req.body;


    const allowedStatuses = [

        "Pending",
        "Preparing",
        "Ready"

    ];


    if (
        !allowedStatuses.includes(status)
    ) {

        return res.status(400).json({

            success: false,

            message:
                "Invalid order status"

        });

    }


    const sql = `

        UPDATE orders

        SET status = ?

        WHERE id = ?

    `;


    db.query(
        sql,
        [
            status,
            orderId
        ],
        (err, result) => {

            if (err) {

                console.log(
                    "❌ Status update failed:",
                    err.message
                );

                return res.status(500).json({

                    success: false,

                    message:
                        "Status update failed"

                });

            }


            if (
                result.affectedRows === 0
            ) {

                return res.status(404).json({

                    success: false,

                    message:
                        "Order not found"

                });

            }


            console.log(
                `✅ Order ${orderId} → ${status}`
            );


            res.json({

                success: true,

                message:
                    "Order status updated!"

            });

        }
    );

});


// ======================================================
// GET PENDING PAYMENTS
// ======================================================

app.get("/api/payments/pending", (req, res) => {

    const sql = `

        SELECT *

        FROM orders

        WHERE status = 'Ready'

        AND payment_status = 'Pending'

        ORDER BY created_at DESC

    `;


    db.query(
        sql,
        (err, results) => {

            if (err) {

                console.log(
                    "❌ Failed to get pending payments:",
                    err.message
                );

                return res.status(500).json({

                    success: false,

                    message:
                        "Could not fetch pending payments"

                });

            }


            res.json({

                success: true,

                orders: results

            });

        }
    );

});


// ======================================================
// MARK PAYMENT AS PAID
// + MAKE TABLE AVAILABLE
// ======================================================

function processPayment(orderId, res) {

    const getOrderSQL = `

        SELECT
            id,
            table_number,
            status,
            payment_status

        FROM orders

        WHERE id = ?

    `;


    db.query(
        getOrderSQL,
        [orderId],
        (err, orderResults) => {

            if (err) {

                console.log(
                    "❌ Failed to get order:",
                    err.message
                );

                return res.status(500).json({

                    success: false,

                    message:
                        "Could not get order"

                });

            }


            if (
                orderResults.length === 0
            ) {

                return res.status(404).json({

                    success: false,

                    message:
                        "Order not found"

                });

            }


            const order =
                orderResults[0];


            const tableNumber =
                order.table_number;


            if (
                order.payment_status === "Paid"
            ) {

                return res.status(400).json({

                    success: false,

                    message:
                        "Payment already received"

                });

            }


            if (
                order.status !== "Ready"
            ) {

                return res.status(400).json({

                    success: false,

                    message:
                        "Order is not ready for payment"

                });

            }


            const paymentSQL = `

                UPDATE orders

                SET payment_status = 'Paid'

                WHERE id = ?

                AND payment_status = 'Pending'

            `;


            db.query(
                paymentSQL,
                [orderId],
                (err, paymentResult) => {

                    if (err) {

                        console.log(
                            "❌ Payment update failed:",
                            err.message
                        );

                        return res.status(500).json({

                            success: false,

                            message:
                                "Payment update failed"

                        });

                    }


                    if (
                        paymentResult.affectedRows === 0
                    ) {

                        return res.status(400).json({

                            success: false,

                            message:
                                "Payment was already processed"

                        });

                    }


                    console.log(
                        `💰 Order ${orderId} → Paid`
                    );


                    const tableSQL = `

                        UPDATE restaurant_tables

                        SET status = 'Available'

                        WHERE table_number = ?

                    `;


                    db.query(
                        tableSQL,
                        [tableNumber],
                        (err) => {

                            if (err) {

                                console.log(
                                    "❌ Table availability update failed:",
                                    err.message
                                );

                                return res.status(500).json({

                                    success: false,

                                    message:
                                        "Payment received but table update failed"

                                });

                            }


                            console.log(
                                `🪑 Table ${tableNumber} → Available`
                            );


                            return res.json({

                                success: true,

                                message:
                                    "Payment received successfully!",

                                orderId:
                                    orderId,

                                table:
                                    tableNumber

                            });

                        }
                    );

                }
            );

        }
    );

}


// ======================================================
// PAYMENT ROUTE 1
// ======================================================

app.put("/api/payments/:id", (req, res) => {

    processPayment(
        req.params.id,
        res
    );

});


// ======================================================
// PAYMENT ROUTE 2
// BILLING.HTML SUPPORT
// ======================================================

app.put("/api/orders/:id/payment", (req, res) => {

    processPayment(
        req.params.id,
        res
    );

});


// ======================================================
// GET PAID ORDERS
// ======================================================

app.get("/api/payments/paid", (req, res) => {

    const sql = `

        SELECT *

        FROM orders

        WHERE payment_status = 'Paid'

        ORDER BY created_at DESC

    `;


    db.query(
        sql,
        (err, results) => {

            if (err) {

                console.log(
                    "❌ Failed to get paid orders:",
                    err.message
                );

                return res.status(500).json({

                    success: false,

                    message:
                        "Could not get paid orders"

                });

            }


            res.json({

                success: true,

                orders: results

            });

        }
    );

});


// ======================================================
// GET ALL TABLES
// ======================================================

app.get("/api/tables", (req, res) => {

    const sql = `

        SELECT *

        FROM restaurant_tables

        ORDER BY table_number ASC

    `;


    db.query(
        sql,
        (err, results) => {

            if (err) {

                console.log(
                    "❌ Failed to get tables:",
                    err.message
                );

                return res.status(500).json({

                    success: false,

                    message:
                        "Could not fetch tables"

                });

            }


            res.json({

                success: true,

                tables: results

            });

        }
    );

});


// ======================================================
// GET ONE TABLE
// ======================================================

app.get("/api/tables/:tableNumber", (req, res) => {

    const tableNumber =
        req.params.tableNumber;


    const sql = `

        SELECT *

        FROM restaurant_tables

        WHERE table_number = ?

    `;


    db.query(
        sql,
        [tableNumber],
        (err, results) => {

            if (err) {

                console.log(
                    "❌ Failed to get table:",
                    err.message
                );

                return res.status(500).json({

                    success: false,

                    message:
                        "Could not get table"

                });

            }


            if (results.length === 0) {

                return res.status(404).json({

                    success: false,

                    message:
                        "Table not found"

                });

            }


            res.json({

                success: true,

                table: results[0]

            });

        }
    );

});


// ======================================================
// UPDATE TABLE STATUS
// ======================================================

app.put(
    "/api/tables/:tableNumber/status",
    (req, res) => {

        const tableNumber =
            req.params.tableNumber;

        const { status } =
            req.body;


        const allowedStatuses = [

            "Available",
            "Occupied"

        ];


        if (
            !allowedStatuses.includes(status)
        ) {

            return res.status(400).json({

                success: false,

                message:
                    "Invalid table status"

            });

        }


        const sql = `

            UPDATE restaurant_tables

            SET status = ?

            WHERE table_number = ?

        `;


        db.query(
            sql,
            [
                status,
                tableNumber
            ],
            (err, result) => {

                if (err) {

                    console.log(
                        "❌ Table status update failed:",
                        err.message
                    );

                    return res.status(500).json({

                        success: false,

                        message:
                            "Table status update failed"

                    });

                }


                if (
                    result.affectedRows === 0
                ) {

                    return res.status(404).json({

                        success: false,

                        message:
                            "Table not found"

                    });

                }


                console.log(
                    `🪑 Table ${tableNumber} → ${status}`
                );


                res.json({

                    success: true,

                    message:
                        "Table status updated!"

                });

            }
        );

    }
);


// ======================================================
// FRONTEND PAGE ROUTES
// ======================================================


// ------------------------------------------------------
// CUSTOMER MENU
//
// IMPORTANT:
// /menu.html → customer menu
// /menu.html?table=1 → Table 1 customer menu
// ------------------------------------------------------

app.get("/menu.html", (req, res) => {

    res.sendFile(
        path.join(
            frontendPath,
            "index.html"
        )
    );

});


// ------------------------------------------------------
// KITCHEN
// ------------------------------------------------------

app.get("/kitchen.html", (req, res) => {

    res.sendFile(
        path.join(
            frontendPath,
            "kitchen.html"
        )
    );

});


// ------------------------------------------------------
// BILLING
// ------------------------------------------------------

app.get("/billing.html", (req, res) => {

    res.sendFile(
        path.join(
            frontendPath,
            "billing.html"
        )
    );

});


// ------------------------------------------------------
// ORDER HISTORY
// ------------------------------------------------------

app.get("/order-history.html", (req, res) => {

    res.sendFile(
        path.join(
            frontendPath,
            "order-history.html"
        )
    );

});


// ------------------------------------------------------
// ORDER STATUS
// ------------------------------------------------------

app.get("/order-status.html", (req, res) => {

    res.sendFile(
        path.join(
            frontendPath,
            "order-status.html"
        )
    );

});


// ------------------------------------------------------
// OLD STATUS URL SUPPORT
// ------------------------------------------------------

app.get("/status.html", (req, res) => {

    res.sendFile(
        path.join(
            frontendPath,
            "order-status.html"
        )
    );

});


// ------------------------------------------------------
// BILL
// ------------------------------------------------------

app.get("/bill.html", (req, res) => {

    res.sendFile(
        path.join(
            frontendPath,
            "bill.html"
        )
    );

});


// ------------------------------------------------------
// QR TABLES
// ------------------------------------------------------

app.get("/qr-tables.html", (req, res) => {

    res.sendFile(
        path.join(
            frontendPath,
            "qr-tables.html"
        )
    );

});


// ------------------------------------------------------
// CASHIER
// ------------------------------------------------------

app.get("/cashier.html", (req, res) => {

    res.sendFile(
        path.join(
            frontendPath,
            "cashier.html"
        )
    );

});


// ------------------------------------------------------
// ADMIN
// ------------------------------------------------------

app.get("/admin.html", (req, res) => {

    res.sendFile(
        path.join(
            frontendPath,
            "admin.html"
        )
    );

});


// ------------------------------------------------------
// TABLES
// ------------------------------------------------------

app.get("/tables.html", (req, res) => {

    res.sendFile(
        path.join(
            frontendPath,
            "tables.html"
        )
    );

});


// ======================================================
// 404 HANDLER
// ======================================================

app.use((req, res) => {

    res.status(404).send(

        `❌ Cannot find: ${req.method} ${req.originalUrl}`

    );

});


// ======================================================
// START SERVER
// ======================================================

const PORT =
    process.env.PORT || 3000;


app.listen(
    PORT,
    "0.0.0.0",
    () => {

        console.log(
            "================================="
        );

        console.log(
            "🚀 Smart Restaurant Server Started"
        );

        console.log(
            "================================="
        );

        console.log(
            `💻 Local: http://localhost:${PORT}`
        );

        console.log(
            `🌐 Server Port: ${PORT}`
        );

        console.log(
            "📂 Frontend: frontend/"
        );

        console.log(
            "🏠 Home: QR Tables"
        );

        console.log(
            "🍽️ Menu: /menu.html"
        );

        console.log(
            "================================="
        );


        // Setup database tables
        setupTables();

    }
);