'use strict'

if(typeof(AWS) === 'undefined') {
    var AWS = require('aws-sdk');
}

if(typeof(lambda) === 'undefined') {
    var lambda = new AWS.Lambda();
}

if(typeof(campusLambda) === 'undefined') {
    var campusLambda = new AWS.Lambda();
}

if(typeof(db) === 'undefined') {
    var db = new AWS.DynamoDB.DocumentClient({ region: "us-east-2" });
}

module.exports = {
    AWS: AWS,
    lambda: lambda,
    campusLambda: campusLambda,
    db: db
};
