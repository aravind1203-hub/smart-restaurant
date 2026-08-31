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
// ======================================================

// /frontend/... support
app.use("/frontend", express.static(frontendPath));

// Main frontend files, CSS, JS, images
app.use(express.static(frontendPath));


// ======================================================
// MYSQL CONFIGURATION
// ======================================================

// Railway / Render production variables
// Local .env variables also supported

const DB_HOST =
    process.env.DB_HOST || process.env.MYSQLHOST;

const DB_PORT =
    process.env.DB_PORT || process.env.MYSQLPORT || 3306;

const DB_USER =
    process.env.DB_USER || process.env.MYSQLUSER;

const DB_PASSWORD =
    process.env.DB_PASSWORD || process.env.MYSQLPASSWORD;

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
        "✅ MySQL connected successfully!"
    );

});


// ======================================================
// HOME PAGE
// ======================================================

// Open Smart Restaurant menu directly
app.get("/", (req, res) => {

    res.sendFile(
        path.join(frontendPath, "index.html")
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

            message: "Invalid order data"

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


            // --------------------------------------------------
            // TABLE NOT FOUND
            // --------------------------------------------------

            if (tableResults.length === 0) {

                return res.status(404).json({

                    success: false,

                    message:
                        `Table ${table} not found`

                });

            }


            // --------------------------------------------------
            // TABLE OCCUPIED
            // --------------------------------------------------

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
                        "✅ Order saved to MySQL!"
                    );

                    console.log(
                        "🧾 Order ID:",
                        orderId
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
                        (err, tableUpdateResult) => {

                            if (err) {

                                console.log(
                                    "❌ Table status update failed:",
                                    err.message
                                );


                                // Delete order if table update fails

                                const deleteOrderSQL = `

                                    DELETE FROM orders

                                    WHERE id = ?

                                `;


                                db.query(
                                    deleteOrderSQL,
                                    [orderId],
                                    () => {

                                        return res.status(500).json({

                                            success: false,

                                            message:
                                                "Could not occupy table"

                                        });

                                    }
                                );

                                return;
                            }


                            if (
                                tableUpdateResult.affectedRows === 0
                            ) {

                                return res.status(500).json({

                                    success: false,

                                    message:
                                        "Table could not be occupied"

                                });

                            }


                            console.log(
                                `🪑 Table ${table} → Occupied`
                            );


                            // --------------------------------------------------
                            // SUCCESS
                            // --------------------------------------------------

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

app.put("/api/payments/:id", (req, res) => {

    const orderId =
        req.params.id;


    // --------------------------------------------------
    // GET ORDER
    // --------------------------------------------------

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


            // --------------------------------------------------
            // ORDER NOT FOUND
            // --------------------------------------------------

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


            // --------------------------------------------------
            // ALREADY PAID
            // --------------------------------------------------

            if (
                order.payment_status === "Paid"
            ) {

                return res.status(400).json({

                    success: false,

                    message:
                        "Payment already received"

                });

            }


            // --------------------------------------------------
            // ONLY READY ORDER CAN BE PAID
            // --------------------------------------------------

            if (
                order.status !== "Ready"
            ) {

                return res.status(400).json({

                    success: false,

                    message:
                        "Order is not ready for payment"

                });

            }


            // --------------------------------------------------
            // MARK PAYMENT AS PAID
            // --------------------------------------------------

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


                    // --------------------------------------------------
                    // MAKE TABLE AVAILABLE
                    // --------------------------------------------------

                    const tableSQL = `

                        UPDATE restaurant_tables

                        SET status = 'Available'

                        WHERE table_number = ?

                    `;


                    db.query(
                        tableSQL,
                        [tableNumber],
                        (err, tableResult) => {

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


                            if (
                                tableResult.affectedRows === 0
                            ) {

                                return res.status(404).json({

                                    success: false,

                                    message:
                                        "Table not found"

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
// FRONTEND SHORTCUT ROUTES
// ======================================================


// Menu
app.get("/menu.html", (req, res) => {

    res.sendFile(
        path.join(frontendPath, "index.html")
    );

});


// Status
app.get("/status.html", (req, res) => {

    res.sendFile(
        path.join(frontendPath, "status.html")
    );

});


// Bill
app.get("/bill.html", (req, res) => {

    res.sendFile(
        path.join(frontendPath, "bill.html")
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
            "================================="
        );

    }
);