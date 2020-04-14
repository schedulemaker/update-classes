'use strict'

if (typeof(cache) === 'undefined'){
   var cache = require('./cache');
}

// List of campuses and codes
var campuses;

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
async function invokeLambda(params) {
  try {
    const data = await cache.lambda.invoke(params).promise();
    data.Payload = data.Payload.replace(/\+/g, '');
    return JSON.parse(data.Payload);
  } catch (err) {
      console.log(err);
      return err;
  }
}

// Calls the banner proxy and returns campues names & codes
async function invokeCampusLambda(params) {
  try {
    const data = await cache.campusLambda.invoke(params).promise();
    data.Payload = data.Payload.replace(/\+/g, '');
    return JSON.parse(data.Payload);
  } catch (err) {
      console.log(err);
      return err;
  }
}

// Puts items into database 
async function putIntoDB(item) {
  try {
    const data = await cache.db.put(item).promise();
    console.log(data);
   } catch (err) {
    console.log(err);
   }
}

// Gets the sections specified by event
async function getSections(input) {
   let params = {
    FunctionName: 'arn:aws:lambda:us-east-2:741865850980:function:banner-proxy:live',
    InvocationType: 'RequestResponse',
    Payload: JSON.stringify(input)
  };
  const result = await invokeLambda(params);
  return result;
}

// Gets the Campus codes (Can probably cache this as well)
async function getCodes() {
  let campusParam = {
    "school": "temple",
    "term": 202036,
    "method": "getCampuses",
    "params": {}
  };

  let params = {
    FunctionName: 'arn:aws:lambda:us-east-2:741865850980:function:banner-proxy:live',
    InvocationType: 'RequestResponse',
    Payload: JSON.stringify(campusParam)
  };
  const result = invokeCampusLambda(params);
  return result;
}

// Formats the class information for the database
async function formatClasses(sections, campuses, event) {

    // Loops through the payload (Need to change the for loop values)
    for (var index = 0; index < 25; index++) {
      var value = index + parseInt(event.params.offset,10);
      if(value == sections.totalCount) {
        break;
      }
      var len = sections.data[index].meetingsFaculty.length;
      var times = [];
  
      for (var index2 = 0; index2 < len; index2++) {
        
        // Calculates how many weeks for each course
        var start = sections.data[index].meetingsFaculty[index2].meetingTime.startDate;
        var end = sections.data[index].meetingsFaculty[index2].meetingTime.endDate;
        var diff = weekDiff(start, end);
        
        // Gets faculty information for each course
        var staff = [];
        var campus;
        var len3 = campuses.length;
        for(var i = 0; i < len3; i++) {
          if(String(sections.data[index].campusDescription).localeCompare(String(campuses[i].description)) == 0) {
            campus = campuses[i].code;
          }
       }
          
        var len2 = sections.data[index].faculty.length;
        for(var j = 0; j < len2; j++) {
          staff.push(sections.data[index].faculty[j].displayName);
        }
        
        let startTime;
        let finishTime;
        
        try {
          startTime = Number(sections.data[index].meetingsFaculty[index2].meetingTime.beginTime);
        } catch (err) {
          startTime = 'N/A';
        }
        
         try {
          finishTime = Number(sections.data[index].meetingsFaculty[index2].meetingTime.endTime);
        } catch (err) {
          finishTime = 'N/A';
        }
        
        // The meetingTimes format
        const items = {
          startTime: startTime,
          endTime: finishTime,
          startDate: String(sections.data[index].meetingsFaculty[index2].meetingTime.startDate),
          endDate: String(sections.data[index].meetingsFaculty[index2].meetingTime.endDate),
          building: sections.data[index].meetingsFaculty[index2].meetingTime.building,
          room: sections.data[index].meetingsFaculty[index2].meetingTime.room,
          instructors: staff,
          monday: sections.data[index].meetingsFaculty[index2].meetingTime.monday,
          tuesday: sections.data[index].meetingsFaculty[index2].meetingTime.tuesday,
          wednesday: sections.data[index].meetingsFaculty[index2].meetingTime.wednesday,
          thursday: sections.data[index].meetingsFaculty[index2].meetingTime.thursday,
          friday: sections.data[index].meetingsFaculty[index2].meetingTime.friday,
          saturday: sections.data[index].meetingsFaculty[index2].meetingTime.saturday,
          sunday: sections.data[index].meetingsFaculty[index2].meetingTime.sunday,
          weeks: diff
        };
        times.push(items);
      }
      // The class format
      const params = {
        TableName: "temple-202036",
        Item: {
          courseName: (String(sections.data[index].subject) + '-' + String(sections.data[index].courseNumber)),
          title: String(sections.data[index].courseTitle),
          crn: Number(sections.data[index].courseReferenceNumber),
          isOpen: sections.data[index].openSection,
          campus: campus,
          attributes: sections.data[index].sectionAttributes[0],
          meetingTimes: times
        }
      };
      
    // Logs class data into the database
    await putIntoDB(params);
  
    }
}

exports.handler = async(event) => {

  // Gets the sections specified
  const sections = await getSections(event);
  
  // Gets the campus codes
  if(typeof campuses == 'undefined') {
    campuses = await getCodes();
    console.log("Cache Miss");
  } else {
    console.log("Cache Hit");
  }
  
  // Calls format function
  await formatClasses(sections, campuses, event);
};
