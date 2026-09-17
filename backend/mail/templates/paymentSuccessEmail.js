exports.paymentSuccessEmail = (name, amount, orderId, paymentId) => {
    return `<!DOCTYPE html>
    <html>

    <head>
        <meta charset="UTF-8">
        <title>Payment Received</title>
        <style>
            body {
                background-color: #ffffff;
                font-family: Arial, sans-serif;
                font-size: 16px;
                line-height: 1.4;
                color: #333333;
                margin: 0;
                padding: 0;
            }

            .container {
                max-width: 600px;
                margin: 0 auto;
                padding: 20px;
                text-align: center;
            }

            .message {
                font-size: 18px;
                font-weight: bold;
                margin-bottom: 20px;
            }

            .body {
                font-size: 16px;
                margin-bottom: 20px;
                text-align: left;
            }

            .support {
                font-size: 14px;
                color: #999999;
                margin-top: 20px;
            }

            .highlight {
                font-weight: bold;
            }
        </style>
    </head>

    <body>
        <div class="container">
            <div class="message">Payment Received</div>
            <div class="body">
                <p>Dear ${name},</p>
                <p>We have successfully received your payment of <span class="highlight">Rs. ${amount}</span>.</p>
                <p>Order Id: ${orderId}</p>
                <p>Payment Id: ${paymentId}</p>
                <p>Thank you for choosing courseKart!</p>
            </div>
            <div class="support">If you have any questions or need assistance, please feel free to reach out to us at
            <a href="mailto:courseKart@gmail.com">courseKart@gmail.com</a>. We are here to help!</div>
        </div>
    </body>

    </html>`;
};
