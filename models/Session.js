const mongooose = require('mongoose');
const uuid = require('uuid');


const sessionSchema = new mongooose.Schema({
    congregate: {
        type: String,
        required: true
    },
    headcount: {
        type: Number,
        default: 0
    },
    owner: {
        type: String,
        required: true
    }
});


const Session = mongooose.model('session', sessionSchema);


module.exports = Session;
