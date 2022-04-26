const http = require('http');
const express = require('express');
const app = express();
const cors = require('cors');
const mongooose = require('mongoose');
var serviceAccount = require("./firebase-admin.json");
const admin = require('firebase-admin');
const routes = require('./Routes/routes');
const socketio = require('socket.io');
var AWS = require('aws-sdk');
const jwt = require('jsonwebtoken');
// const Session = require('./models/Session');
const Congregate = require('./models/Congregate');
const { RtcTokenBuilder, RtmTokenBuilder, RtcRole, RtmRole } = require('agora-access-token')
const { v4: uuidv4 } = require('uuid');
const schedule = require('node-schedule');
var ziti = require('ziti-sdk-nodejs');


const ziti_init = async (identity) => {
    return new Promise((resolve) => {
        ziti.ziti_init(identity, () => {
            resolve();
        });
    });
};


const ziti_service_available = (service) => {
    return new Promise((resolve) => {
        ziti.ziti_service_available(service, (status) => {
            resolve(status);
        });
    });
};

function ziti_dial(service) {
    return new Promise((resolve, reject) => {
        ziti.ziti_dial(
            service,
            (conn) => {
                resolve(conn);
            },
            (data) => {
                // Do something with data...
            },
        );
    });
}

const ziti_write = (conn, data) => {
    return new Promise((resolve) => {
        ziti.ziti_write(conn, data, () => {
            resolve();
        });
    });
};


(async () => {

    await ziti_init("./nodejs-hackathon.jwt");

    let status = await ziti_service_available("nodejs-service-hackathon");

    if (status === 0) {

        const conn = await ziti_dial("nodejs-service-hackathon");

        let data = SOME_KIND_OF_DATA;

        let buffer = Buffer.from(data);

        await ziti_write(conn, buffer);
    }

})();

app.use(express.json());
app.use(cors());
AWS.config.update({
    region: 'ap-south-1',
    accessKeyId: process.env.AWS_KEY,
    secretAccessKey: process.env.AWS_SECRET
});



//connect to mongodb
mongooose.connect(process.env.MONGO, { useNewUrlParser: true, useUnifiedTopology: true, serverSelectionTimeoutMS: 5000 }).then(
    () => { console.log('connected to database') },
)

admin.initializeApp({
    credential: admin.credential.cert(serviceAccount)
});

app.use('/api/', routes);

const server = http.createServer(app);
const io = socketio(server, {
    cors: {
        origin: '*',
    }
});
//////////////SOCKET.IO////////////////////////////

io.on('connect', (socket) => {
    socket.on('join-session', async (data) => {
        if (data.token) {
            jwt.verify(data.token, 'monish8147332741', async (err, decoded) => {
                if (err) {
                    socket.emit('error', { message: 'Invalid join token' });
                } else {
                    await socket.join(decoded.congregate);
                    let congregate = await Congregate.findOne({ uuid: decoded.congregate });

                    socket.emit('join-success', {
                        status: congregate.status,
                        type: decoded.type,
                        message: 'Joined session successfully',
                    });



                    //emit to everyone in the session
                    // io.to(decoded.congregate).emit('session-update', {
                    //     status: congregate.status,
                    //     type: decoded.type,
                    //     message: 'Session updated',
                    // });

                }
            })
        }
    });

    socket.on('start-session', async (data) => {
        const expirationTimeInSeconds = 3600

        const currentTimestamp = Math.floor(Date.now() / 1000)

        const privilegeExpiredTs = currentTimestamp + expirationTimeInSeconds
        if (data.token) {
            jwt.verify(data.token, 'monish8147332741', async (err, decoded) => {
                if (err) {
                    socket.emit('error', { message: 'Invalid join token' });
                } else if (decoded.type === 'owner') {
                    let congregate = await Congregate.findOne({ uuid: decoded.congregate });
                    congregate.status = 'Started';
                    await congregate.save();

                    const tokenA = await RtcTokenBuilder.buildTokenWithUid(process.env.APPID, process.env.TOKEN, congregate.uuid, decoded.uid, RtcRole.PUBLISHER, privilegeExpiredTs);
                    console.log("Token With Integer Number Uid: " + tokenA);

                    const tokenB = await RtmTokenBuilder.buildToken(process.env.APPID, process.env.TOKEN, decoded.uid, RtmRole.Rtm_User, privilegeExpiredTs);
                    console.log("Token With String Number Uid: " + tokenB);

                    socket.emit('start-success', {
                        status: congregate.status,
                        type: decoded.type,
                        message: 'Session started',
                        agoraToken: tokenA,
                        agoraToken2: tokenB,
                        uid: decoded.uid
                    });

                    //emit to everyone in the session
                    io.to(decoded.congregate).emit('session-update', {
                        status: congregate.status,
                        message: 'Session updated',
                    });

                    //crearte a schedule to end the session after 1 hour
                    schedule.scheduleJob('* 1 * * *', async () => {
                        let congregate = await Congregate.findOne({ uuid: decoded.congregate });
                        congregate.status = 'Ended';
                        await congregate.save();

                        io.to(decoded.congregate).emit('session-end', {
                            status: congregate.status,
                            message: 'Session ended',
                        });
                    })
                }
            })
        }
    });


    socket.on('attendee-join-session', async (data) => {
        console.log(data);
        const expirationTimeInSeconds = 3600

        const currentTimestamp = Math.floor(Date.now() / 1000)

        const privilegeExpiredTs = currentTimestamp + expirationTimeInSeconds
        if (data.token) {
            jwt.verify(data.token, 'monish8147332741', async (err, decoded) => {
                if (err) {
                    socket.emit('error', { message: 'Invalid join token' });
                } else {
                    await socket.join(decoded.congregate);
                    let congregate = await Congregate.findOne({ uuid: decoded.congregate });

                    if (!congregate.status === 'Started') {
                        return socket.emit('join-failed', {
                            status: congregate.status,
                            type: decoded.type,
                            message: 'Session not started',
                        });
                    }

                    const ranid = uuidv4();

                    const tokenA = await RtcTokenBuilder.buildTokenWithUid(process.env.APPID, process.env.TOKEN, congregate.uuid, decoded.type === "anonymous" ? ranid : decoded.email, RtcRole.SUBSCRIBER, privilegeExpiredTs);
                    console.log("Token With Integer Number Uid: " + tokenA);

                    const tokenB = await RtmTokenBuilder.buildToken(process.env.APPID, process.env.TOKEN, decoded.type === "anonymous" ? ranid : decoded.email, RtmRole.Rtm_User, privilegeExpiredTs);
                    console.log("Token With String Number Uid: " + tokenB);


                    socket.emit('attendee-join-success', {
                        status: congregate.status,
                        type: decoded.type,
                        message: 'Joined session successfully',
                        agoraToken: tokenA,
                        agoraToken2: tokenB,
                        uid: decoded.type === "anonymous" ? ranid : decoded.email,
                        name: decoded.type === "anonymous" ? "Anonymous User" : decoded.name
                    });

                    //emit to everyone in the session
                    io.to(decoded.congregate).emit('session-update', {
                        status: congregate.status,
                        type: decoded.type,
                        message: 'Session updated',
                    });
                }
            })
        }
    })


    socket.on('audio-control', (data) => {
        if (data.token) {
            if (data.sound === "party" || data.sound === "glass") {
                jwt.verify(data.token, 'monish8147332741', async (err, decoded) => {
                    return io.to(decoded.congregate).emit('audio-status', {
                        sound: data.sound,
                        control: data.control
                    });
                })
            }
            jwt.verify(data.token, 'monish8147332741', async (err, decoded) => {
                if (err) {
                    socket.emit('error', { message: 'Invalid join token' });
                } else if (decoded.type === 'owner') {

                    io.to(decoded.congregate).emit('audio-status', {
                        sound: data.sound,
                        control: data.control
                    });

                }
            })
        }
    })

    socket.on('end-session', async (data) => {
        if (data.token) {
            jwt.verify(data.token, 'monish8147332741', async (err, decoded) => {
                if (err) {
                    socket.emit('error', { message: 'Invalid join token' });
                } else if (decoded.type === 'owner') {
                    let congregate = await Congregate.findOne({ uuid: decoded.congregate });
                    congregate.status = 'Ended';
                    await congregate.save();

                    io.to(decoded.congregate).emit('session-end', {
                        status: congregate.status,
                        message: 'Session ended',
                    });
                }
            })
        }
    }
    );

});

////////////////////////////////////////////////////

//listen to port 3000
server.listen(4000, () => {
    console.log('server is running on port 4000');
});