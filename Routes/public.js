const router = require('express').Router();
const admin = require('firebase-admin');
const Congregate = require('../models/Congregate');
var jwt = require('jsonwebtoken');

router.get("/congregates/join-info/:uuid", async (req, res) => {
    //check if Authorization header is present
    const congregate = await Congregate.findOne({ uuid: req.params.uuid });
    if (!congregate) {
        return res.send({
            success: false,
            message: "Congregate not found",
            notExist: true
        });
    } else {
        let isOwner = false;
        let decodedToken = null;
        let inviteeToken = null;
        let inviteeTokenData = null;
        if (req.headers.authorization) {
            req.headers.authorization = req.headers.authorization.replace('Bearer ', '');
            decodedToken = await admin.auth().verifyIdToken(req.headers.authorization);
            isOwner = decodedToken.uid === congregate.owner;
        }
        if (req.query.token) {
            jwt.verify(req.query.token, 'monish8147332741', function (err, decoded) {
                if (!err) {
                    if (req.params.uuid === decoded.congregate) {
                        inviteeToken = true;
                        inviteeTokenData = decoded;
                    }
                }
            });
        }
        const accessGranted = isOwner || congregate.anyoneCanJoin || decodedToken && congregate.invitees.some(invitee => invitee.email === decodedToken.email) || inviteeToken || false
        congregate.password = undefined;
        congregate.invitees = undefined;
        let token = accessGranted ? jwt.sign({
            uid: decodedToken ? decodedToken.uid : '',
            isOwner: isOwner,
            email: decodedToken ? decodedToken.email : inviteeTokenData ? inviteeTokenData.email : undefined,
            name: inviteeTokenData && !isOwner ? inviteeTokenData.name : undefined,
            congregate: req.params.uuid,
            type: isOwner ? 'owner' : inviteeToken ? 'invitee' : 'anonymous'
        }, "monish8147332741", {
            expiresIn: '2h'
        }) : undefined;

        return res.send({
            success: true,
            message: "Congregate found",
            owner: isOwner,
            accessGranted: accessGranted,
            congregate: accessGranted ? congregate : { theme: congregate.theme },
            type: isOwner ? 'owner' : inviteeToken ? 'invitee' : 'anonymous',
            name: inviteeTokenData ? inviteeTokenData.name : undefined,
            token: token
        });
    }



});


module.exports = router;