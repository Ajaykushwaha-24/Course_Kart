const nodemailer = require('nodemailer');

const mailSender = async (email, title, body) => {
    if (!process.env.MAIL_HOST || !process.env.MAIL_USER || !process.env.MAIL_PASS) {
        console.log(`Mail not configured - skipping email to ${email} - subject: ${title}`);
        return { skipped: true };
    }

    try {
        const transporter = nodemailer.createTransport({
            host: process.env.MAIL_HOST,
            auth: {
                user: process.env.MAIL_USER,
                pass: process.env.MAIL_PASS

            }      
        });

        const info = await transporter.sendMail({
            from: 'CourseKart || Achintya Tiwari',
            to: email,
            subject: title,
            html: body
        });

        // console.log('Info of sent mail - ', info);
        return info;
    }
    catch (error) {
        console.log('Error while sending mail (mailSender) - ', email);
        throw error;
    }
}

module.exports = mailSender;