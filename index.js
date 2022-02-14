export async function setupPlugin({ config, global, cache }) {
    console.info(`Setting up the plugin`);
    
    global.baseURL = `https://api.twilio.com/2010-04-01/Accounts/${config.accountSID}/Messages.json`;

    global.token = Buffer.from(
        `${config.accountSID}:${config.authToken}`
      ).toString("base64");
  
    global.defaultHeaders = {
      headers: {
        Authorization: `Basic ${global.token}`,
        "Content-Type": "application/x-www-form-urlencoded",
      },
    };

    let pairs = (config.triggeringEventsAndNumber || "")
    .split(",")
    .map(function (value) {
      return value.trim();
    });

    global.eventAndNumberMap = {}
    for(let pair of pairs){
        let val = (pair || "")
        .split(":")
        .map(function (value) {
        return value.trim();
        global.eventAndNumberMap[val[0]] = val[1];
    });
    }
    console.table(global.eventAndNumberMap)

    }
    
async function fetchWithRetry(
    url,
    options = {},
    method = "GET",
    isRetry = false
    ) {
    try {
        const res = await fetch(url, { method: method, ...options });
        return res;
    } catch {
        if (isRetry) {
        throw new Error(`${method} request to ${url} failed.`);
        }
        const res = await fetchWithRetry(
        url,
        options,
        (method = method),
        (isRetry = true)
        );
        return res;
    }
    }


async function sendMessageWithTwilio(eventName, config, global, cache){ 
    const number = global.eventAndNumberMap[eventName]
    if (await cache.get(`$(eventName}-${number}`)){
        break
    }else{
    let urlencoded = new URLSearchParams();
    urlencoded.append("Body", `Hi, ${eventName} occured - PostHog`);
    urlencoded.append("From", `${config.senderPhoneNumber}`);
    urlencoded.append("To", `${number}`);

    const myheaders = global.defaultHeaders

    myheaders.body = urlencoded;

    await fetchWithRetry(global.baseURL, myheaders, 'POST')
    await cache.set(`$(eventName}-${number}`, true ,config.timeout)
}
}


export async function onEvent(event, { config, global, cache }) {
   if(!global.eventAndNumberMap[event.event]){
       break
   }else{
       await sendMessageWithTwilio(event.event, config, global, storage)
   }
    
}