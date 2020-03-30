'use strict'

// Need to change so it gets every class and add better variable names
// also make a little more efficient and cleaner 

const AWS = require('aws-sdk');
AWS.config.update({ region: "us-east-2" });
let lambda = new AWS.Lambda();

// Returns an array of weeks for each course
function weekDiff(start, end) {
  var s = new Array();
  var e = new Array();
  var output = new Array();
  s = start.split("/");
  e = end.split("/");
  let d1 = new Date(s[2], s[0], s[1]);
  let d2 = new Date(e[2], e[0], e[1]);
  let d3 = (d2 - d1) / 604800000;
  for (var i = 1; i <= Math.round(d3); i++) {
    output.push(i);
  }
  return output;
}

// Calls the banner proxy and returns class info in JSON format
const invokeLambda = async(params) => {
  const data = await lambda.invoke(params).promise();
  data.Payload = data.Payload.replace(/\+/g, '');
  return JSON.parse(data.Payload);
}

exports.handler = async(event, context) => {
  const db = new AWS.DynamoDB.DocumentClient({ region: "us-east-2" });
  

  // Input for banner proxy lambda 
  let input = {
    FunctionName: 'arn:aws:lambda:us-east-2:741865850980:function:banner-proxy:live',
    InvocationType: 'RequestResponse',
    Payload: JSON.stringify(event)
  };

 // Invokes the banner lambda and gets the payload
  const result = await invokeLambda(input);

  // Loops through the payload (Need to change the for loop values)
  for (var index = 0; index < 25; index++) {
    if(index == result.totalCount) {
      break;
    }
    var len = result.data[index].meetingsFaculty.length;
    var times = [];

    for (var index2 = 0; index2 < len; index2++) {
      // Calculates how many weeks for each course
      var start = result.data[index].meetingsFaculty[index2].meetingTime.startDate;
      var end = result.data[index].meetingsFaculty[index2].meetingTime.endDate;
      var diff = weekDiff(start, end);
      
      // Gets faculty information for each course
      var staff = [];
      var len2 = result.data[index].faculty.length;
      for(var j = 0; j < len2; j++) {
        staff.push(result.data[index].faculty[j].displayName);
      }
      
      // The meetingTimes format
      const items = {
        startTime: result.data[index].meetingsFaculty[index2].meetingTime.beginTime,
        endTime: result.data[index].meetingsFaculty[index2].meetingTime.endTime,
        building: result.data[index].meetingsFaculty[index2].meetingTime.building,
        room: result.data[index].meetingsFaculty[index2].meetingTime.room,
        instructors: staff,
        monday: result.data[index].meetingsFaculty[index2].meetingTime.monday,
        tuesday: result.data[index].meetingsFaculty[index2].meetingTime.tuesday,
        wednesday: result.data[index].meetingsFaculty[index2].meetingTime.wednesday,
        thursday: result.data[index].meetingsFaculty[index2].meetingTime.thursday,
        friday: result.data[index].meetingsFaculty[index2].meetingTime.friday,
        saturday: result.data[index].meetingsFaculty[index2].meetingTime.saturday,
        sunday: result.data[index].meetingsFaculty[index2].meetingTime.sunday,
        weeks: diff
      }
      times.push(items);
    }
    // The class format
    const params = {
      TableName: "temple-202036",
      Item: {
        courseName: result.data[index].courseTitle,
        crn: parseInt(result.data[index].courseReferenceNumber),
        isOpen: result.data[index].openSection,
        campus: result.data[index].campusDescription,
        attributes: result.data[index].sectionAttributes[0],
        meetingTimes: times
      }
    }
    
  // Logs class data into the database
  try {
    const data = await db.put(params).promise();
    console.log(data);
   } catch (err) {
    console.log(err);
   }
  }

};
