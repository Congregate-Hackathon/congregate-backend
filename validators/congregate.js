const joiTimezone = require("joi-timezone");
let joi = require('joi');


const createCongregateSchema = data => {
    const schema = joi.object().keys({
        name: joi.string().required(),
        description: joi.string().required(),
        date: joi.date().required(),
        time: joi.string().required(),
        theme: joi.string().required().valid("birthday", "campfire", "yoga", "dance"),
        //if theme is birthday take birthday email
        birthday: joi.string().when('theme', {
            is: "birthday",
            then: joi.string().email().required(),
            otherwise: joi.string().optional().min(0)
        }),
        invitees: joi.array().items(joi.object().keys({
            name: joi.string().required(),
            email: joi.string().email().required(),
        })).min(1).required(),
        anyoneCanJoin: joi.boolean().required(),
        passwordProtected: joi.boolean().required(),
        //password required if passwordProtected is true
        password: joi.string().when('passwordProtected', {
            is: true,
            then: joi.string().required().min(6),
            otherwise: joi.string().optional().min(0)
        }),
        timezone: joi.string().required(),
    });

    return schema.validate(data);

}

module.exports = {
    createCongregateSchema
}