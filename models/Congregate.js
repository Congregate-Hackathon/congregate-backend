const mongooose = require('mongoose');
const uuid = require('uuid');


const congregateSchema = new mongooose.Schema({
    name: {
        type: String,
    },
    description: {
        type: String,
    },
    date: {
        type: Date,
    },
    time: {
        type: String,
    },
    theme: {
        type: String,
    },
    invitees: {
        type: Array,
    },
    anyoneCanJoin: {
        type: Boolean,
    },
    passwordProtected: {
        type: Boolean,
    },
    password: {
        type: String,
    },
    owner: {
        type: String,
    },
    created_at: {
        type: Date,
        default: Date.now
    },
    status: {
        type: String,
        default: 'Upcoming'
    },
    uuid: {
        type: String,
        default: () => uuid.v4()
    },
    timezone: {
        type: String,
    },
    birthday: {
        type: String
    }
});


const Congregate = mongooose.model('congregate', congregateSchema);


module.exports = Congregate;