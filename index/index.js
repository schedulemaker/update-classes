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

// Gets the Campus codes 
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
async function formatSections(sections, event) {

    // Iterates through all the sections
    for (var sectionIndex = 0; sectionIndex < 25; sectionIndex++) {
      var value = sectionIndex + parseInt(event.params.offset,10);
      if(value == sections.totalCount) {
        break;
      }

      // Gets all needed information for all the meeting times of a section
      var meetingTimes = [];
      var meetingLength = sections.data[sectionIndex].meetingsFaculty.length;
  
      for (var meetingIndex = 0; meetingIndex < meetingLength; meetingIndex++) {
        
        // Calculates how many weeks for each meeting time
        var start = sections.data[sectionIndex].meetingsFaculty[meetingIndex].meetingTime.startDate;
        var end = sections.data[sectionIndex].meetingsFaculty[meetingIndex].meetingTime.endDate;
        var diff = weekDiff(start, end);
        
        // Finds campus code for each meeting time
        var campus;

        var campusesLength = campuses.length;
        for(var index = 0; index < campusesLength; index++) {
          if(String(sections.data[sectionIndex].campusDescription).localeCompare(String(campuses[index].description)) == 0) {
            campus = campuses[index].code;
          }
       }
          
        // Gets faculty information for each meeting time
        var staff = [];
        var facultyLength = sections.data[sectionIndex].faculty.length;

        for(index = 0; index < facultyLength; index++) {
          staff.push(sections.data[sectionIndex].faculty[index].displayName);
        }
        
        // Gets start and end time for each meeting time
        let startTime;
        let finishTime;
        
        try {
          startTime = Number(sections.data[sectionIndex].meetingsFaculty[meetingIndex].meetingTime.beginTime);
        } catch (err) {
          startTime = 'N/A';
        }
        
         try {
          finishTime = Number(sections.data[sectionIndex].meetingsFaculty[meetingIndex].meetingTime.endTime);
        } catch (err) {
          finishTime = 'N/A';
        }
        
        // The meetingTimes format
        const items = {
          startTime: startTime,
          endTime: finishTime,
          startDate: String(sections.data[sectionIndex].meetingsFaculty[meetingIndex].meetingTime.startDate),
          endDate: String(sections.data[sectionIndex].meetingsFaculty[meetingIndex].meetingTime.endDate),
          building: sections.data[sectionIndex].meetingsFaculty[meetingIndex].meetingTime.building,
          room: sections.data[sectionIndex].meetingsFaculty[meetingIndex].meetingTime.room,
          instructors: staff,
          monday: sections.data[sectionIndex].meetingsFaculty[meetingIndex].meetingTime.monday,
          tuesday: sections.data[sectionIndex].meetingsFaculty[meetingIndex].meetingTime.tuesday,
          wednesday: sections.data[sectionIndex].meetingsFaculty[meetingIndex].meetingTime.wednesday,
          thursday: sections.data[sectionIndex].meetingsFaculty[meetingIndex].meetingTime.thursday,
          friday: sections.data[sectionIndex].meetingsFaculty[meetingIndex].meetingTime.friday,
          saturday: sections.data[sectionIndex].meetingsFaculty[meetingIndex].meetingTime.saturday,
          sunday: sections.data[sectionIndex].meetingsFaculty[meetingIndex].meetingTime.sunday,
          weeks: diff
        };
        meetingTimes.push(items);
      }

      // The section format
      const dbEntry = {
        TableName: "temple-202036",
        Item: {
          courseName: (String(sections.data[sectionIndex].subject) + '-' + String(sections.data[sectionIndex].courseNumber)),
          title: String(sections.data[sectionIndex].courseTitle),
          crn: Number(sections.data[sectionIndex].courseReferenceNumber),
          isOpen: sections.data[sectionIndex].openSection,
          campus: campus,
          attributes: sections.data[sectionIndex].sectionAttributes[0],
          meetingTimes: meetingTimes
        }
      };
      
    // Logs section data into the database
    await putIntoDB(dbEntry);
     
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
  
  // Formates each sections & logs it to the database
  await formatSections(sections, event);
};
