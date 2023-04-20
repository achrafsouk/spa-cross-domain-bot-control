exports.handler = async function(event) {
    var response = {};
  
    Object.entries(event.headers).forEach((entry) => {
      const [key, value] = entry;
      if (key.includes('waf')) {
        response[key] = 'found'
      }
    });
    
    if (Object.keys(response).length == 0 ) {
      response.signals = 'not found'
    }
    
    return {
      statusCode: 200,
      headers: { "content-type": "application/json" },
      body:  JSON.stringify(response),
    };
  };