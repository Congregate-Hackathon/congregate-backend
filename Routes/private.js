const router = require('express').Router();
const firebaseMiddleware = require('express-firebase-middleware');
const Congregate = require('../models/Congregate');
const { createCongregateSchema } = require('../validators/congregate');
var AWS = require('aws-sdk');
const jwt = require('jsonwebtoken');

router.use(firebaseMiddleware.auth);


router.get("/congregates", (req, res) => {
    Congregate.find({ owner: res.locals.user.uid }, (err, congregates) => {
        if (err) {
            res.send({
                success: false,
                message: err
            });
        } else {
            res.send(
                {
                    success: true,
                    congregates: congregates
                }
            );
        }
    });
})


router.post("/congregate", (req, res) => {
    const { error } = createCongregateSchema(req.body);
    if (error) {
        res.send({
            success: false,
            message: error.details[0].message
        });
    } else {
        //if any invitee email is same as owner mail, throw error
        if (req.body.invitees.some(invitee => invitee.email === res.locals.user.email)) {
            res.send({
                success: false,
                message: "You can't invite yourself"
            });
        } else {
            const newCongregate = new Congregate({
                name: req.body.name,
                description: req.body.description,
                date: req.body.date,
                time: req.body.time,
                theme: req.body.theme,
                invitees: req.body.invitees,
                anyoneCanJoin: req.body.anyoneCanJoin,
                passwordProtected: req.body.passwordProtected,
                password: req.body.password,
                owner: res.locals.user.uid,
                created_at: Date.now(),
                status: 'Upcoming',
                timezone: req.body.timezone
            });
            newCongregate.save((err, congregate) => {
                if (err) {
                    res.send({
                        success: false,
                        message: err
                    });
                } else {
                    res.send({
                        success: true,
                        congregate: congregate
                    });
                    //generate join tokens for every invitee and send email
                    req.body.invitees.forEach(invitee => {
                        const token = jwt.sign({
                            email: invitee.email,
                            congregate: congregate.uuid,
                            name: invitee.name
                        }, "monish8147332741", {
                            expiresIn: '90d'
                        });
                        const params = {
                            Destination: { /* required */
                                ToAddresses: [
                                    invitee.email,
                                    /* more items */
                                ]
                            },
                            Message: { /* required */
                                Body: { /* required */
                                    Html: {
                                        Charset: "UTF-8",
                                        Data: `<h1>Hi ${invitee.name}!</h1>
                                                <p>You have been invited to join a Congregate on ${congregate.date} at ${congregate.time} in ${congregate.timezone}</p>
                                                <p>Please click on the following link to join the Congregate:</p>
                                                <a href="https://congregate-app.herokuapp.com/join/${token}">https://congregate-app.herokuapp.com/join/${token}</a>
                                                `
                                    },
                                    Text: {
                                        Charset: "UTF-8",
                                        Data: `Hi ${invitee.name}!
                                                You have been invited to join a Congregate on ${congregate.date} at ${congregate.time} in ${congregate.timezone}
                                                Please click on the following link to join the Congregate:
                                                https://congregate-app.herokuapp.com/join/${token}
                                                `
                                    },
                                },
                                Subject: {
                                    Charset: 'UTF-8',
                                    Data: 'Congregate Invitation'
                                }
                            },
                            Source: 'monish2.basaniwal@gmail.com',
                        };
                        const sendPromise = new AWS.SES({ apiVersion: '2010-12-01' }).sendEmail(params).promise();
                        sendPromise.then(
                            function (data) {
                                console.log(data.MessageId);
                            }
                        ).catch(
                            function (err) {
                                console.error(err, err.stack);
                            }
                        );
                    });

                }
            });
        }
    }
});


router.post("/testmail", (req, res) => {
    var sendPromise = new AWS.SES({ apiVersion: '2010-12-01' }).sendEmail(params).promise();

    // Handle promise's fulfilled/rejected states
    sendPromise.then(
        function (data) {
            console.log(data.MessageId);
        }).catch(
            function (err) {
                console.error(err, err.stack);
            });
});



module.exports = router;