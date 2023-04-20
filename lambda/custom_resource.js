const AWS = require('aws-sdk');
const wafv2 = new AWS.WAFV2({ region: 'us-east-1' });


exports.handler = async function(event) {
    try {
    // code to be improved
      const params = {
        Id: event.ResourceProperties.Id,
        Name: event.ResourceProperties.Name,
        Scope: event.ResourceProperties.Scope
      };

      switch (event.RequestType) {
        case "Create":
          let result = await wafv2.getWebACL(params).promise(); 
          return { 'Data': { 'ApplicationIntegrationURL': result.ApplicationIntegrationURL } }
        case "Update":
        case "Delete":
          return { 'PhysicalResourceId': event.PhysicalResourceId }
      }

  } catch (error) {

  }
  
};