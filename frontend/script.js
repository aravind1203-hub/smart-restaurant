// ==========================================
// SERVER URL
// ==========================================

const SERVER_URL = "http://10.29.95.40:3000";


// ==========================================
// GET TABLE NUMBER FROM URL
// ==========================================

const urlParams =
    new URLSearchParams(window.location.search);

const tableNumber =
    urlParams.get("table") || "1";


// ==========================================
// SHOW TABLE NUMBER
// ==========================================

const tableElement =
    document.getElementById("table-number");

if (tableElement) {

    tableElement.textContent =
        tableNumber;

}


// ==========================================
// CART
// ==========================================

let cart = [];


// ==========================================
// TABLE AVAILABLE CHECK
// ==========================================

async function checkTableAvailability() {

    try {

        console.log(
            `🔍 Checking Table ${tableNumber}...`
        );


        const response = await fetch(

            `${SERVER_URL}/api/tables/${tableNumber}`

        );


        const data =
            await response.json();


        console.log(
            "🪑 Table response:",
            data
        );


        // ==========================================
        // SERVER ERROR
        // ==========================================

        if (!response.ok || !data.success) {

            console.error(
                "❌ Table check failed"
            );

            return;

        }


        const table =
            data.table;


        // ==========================================
        // TABLE OCCUPIED
        // ==========================================

        if (table.status === "Occupied") {

            alert(

                `🔴 TABLE ${tableNumber} IS ALREADY OCCUPIED!\n\n` +

                `❌ Seat not available.\n\n` +

                `Please choose another table.`

            );


            // ==========================================
            // DISABLE FOOD BUTTONS
            // ==========================================

            const foodButtons =
                document.querySelectorAll(
                    ".food-card button"
                );


            foodButtons.forEach(button => {

                button.disabled = true;

                button.textContent =
                    "Table Unavailable";

            });


            // ==========================================
            // DISABLE PLACE ORDER BUTTON
            // ==========================================

            const cartButtons =
                document.querySelectorAll(
                    ".cart button"
                );


            cartButtons.forEach(button => {

                button.disabled = true;

            });


            // ==========================================
            // SHOW OCCUPIED MESSAGE
            // ==========================================

            const cartElement =
                document.querySelector(".cart");


            if (cartElement) {

                const message =
                    document.createElement("div");


                message.style.background =
                    "#ffe5e5";

                message.style.color =
                    "#b00000";

                message.style.padding =
                    "15px";

                message.style.marginTop =
                    "15px";

                message.style.borderRadius =
                    "10px";

                message.style.textAlign =
                    "center";

                message.style.fontWeight =
                    "bold";


                message.innerHTML =

                    `🔴 Table ${tableNumber} is occupied.<br>` +

                    `❌ Seat not available.`;



                cartElement.appendChild(
                    message
                );

            }

        }


        // ==========================================
        // TABLE AVAILABLE
        // ==========================================

        else if (table.status === "Available") {

            console.log(

                `🟢 Table ${tableNumber} is available`

            );

        }

    }


    catch (error) {

        console.error(

            "❌ Table availability error:",
            error

        );

        // Don't show "server error" here
        // because the order function handles it.

    }

}


// ==========================================
// RUN TABLE CHECK
// ==========================================

checkTableAvailability();


// ==========================================
// ADD TO CART
// ==========================================

function addToCart(name, price) {

    const existingItem =
        cart.find(
            item => item.name === name
        );


    if (existingItem) {

        existingItem.quantity++;

    }

    else {

        cart.push({

            name: name,
            price: price,
            quantity: 1

        });

    }


    updateCart();

}


// ==========================================
// INCREASE QUANTITY
// ==========================================

function increaseQuantity(index) {

    if (!cart[index]) {

        return;

    }


    cart[index].quantity++;

    updateCart();

}


// ==========================================
// DECREASE QUANTITY
// ==========================================

function decreaseQuantity(index) {

    if (!cart[index]) {

        return;

    }


    cart[index].quantity--;


    if (cart[index].quantity <= 0) {

        cart.splice(index, 1);

    }


    updateCart();

}


// ==========================================
// REMOVE ITEM
// ==========================================

function removeItem(index) {

    if (!cart[index]) {

        return;

    }


    cart.splice(index, 1);

    updateCart();

}


// ==========================================
// UPDATE CART
// ==========================================

function updateCart() {

    const cartItems =
        document.getElementById("cart-items");


    const totalElement =
        document.getElementById("total");


    if (!cartItems || !totalElement) {

        return;

    }


    cartItems.innerHTML = "";


    let total = 0;


    cart.forEach((item, index) => {

        const itemTotal =
            item.price * item.quantity;


        total += itemTotal;


        cartItems.innerHTML += `

            <li>

                <strong>
                    ${item.name}
                </strong>

                - ₹${item.price}

                <br><br>

                <button
                    onclick="decreaseQuantity(${index})">

                    -

                </button>


                <span
                    style="margin: 0 10px;">

                    ${item.quantity}

                </span>


                <button
                    onclick="increaseQuantity(${index})">

                    +

                </button>


                <button
                    onclick="removeItem(${index})">

                    Remove

                </button>

            </li>

            <br>

        `;

    });


    totalElement.textContent =
        `Total: ₹${total}`;

}


// ==========================================
// PLACE ORDER
// ==========================================

async function placeOrder() {


    // ==========================================
    // CHECK CART
    // ==========================================

    if (cart.length === 0) {

        alert(
            "🛒 Cart is empty!"
        );

        return;

    }


    // ==========================================
    // CALCULATE TOTAL
    // ==========================================

    let total = 0;


    cart.forEach(item => {

        total +=
            item.price * item.quantity;

    });


    try {


        console.log(

            "📡 Sending order to:",
            SERVER_URL

        );


        // ==========================================
        // SEND ORDER
        // ==========================================

        const response = await fetch(

            `${SERVER_URL}/api/orders`,

            {

                method: "POST",

                headers: {

                    "Content-Type":
                        "application/json"

                },

                body: JSON.stringify({

                    table: tableNumber,

                    items: cart,

                    total: total

                })

            }

        );


        // ==========================================
        // READ RESPONSE
        // ==========================================

        const data =
            await response.json();


        console.log(

            "📥 Server response:",
            data

        );


        // ==========================================
        // TABLE OCCUPIED
        // ==========================================

        if (response.status === 409) {

            alert(

                `🪑 TABLE ${tableNumber} IS ALREADY OCCUPIED!\n\n` +

                `❌ Seat not available.\n\n` +

                `Please choose another table.`

            );


            return;

        }


        // ==========================================
        // OTHER SERVER ERROR
        // ==========================================

        if (!response.ok) {

            alert(

                "❌ " +

                (

                    data.message ||

                    `Server error: ${response.status}`

                )

            );


            return;

        }


        // ==========================================
        // ORDER SUCCESS
        // ==========================================

        if (data.success) {


            alert(

                `✅ Order placed successfully!\n\n` +

                `🪑 Table: ${tableNumber}\n` +

                `🧾 Order ID: ${data.orderId}\n` +

                `💰 Total: ₹${total}`

            );


            // ==========================================
            // CLEAR CART
            // ==========================================

            cart = [];

            updateCart();


            // ==========================================
            // GO TO ORDER STATUS
            // ==========================================

            window.location.href =

                `order-status.html?order=${data.orderId}`;

        }


        else {

            alert(

                "❌ " +

                (

                    data.message ||

                    "Order could not be placed!"

                )

            );

        }

    }


    // ==========================================
    // CONNECTION ERROR
    // ==========================================

    catch (error) {

        console.error(

            "❌ Order error:",
            error

        );


        alert(

            "❌ Cannot connect to restaurant server!\n\n" +

            "Please check that the backend server is running."

        );

    }

}