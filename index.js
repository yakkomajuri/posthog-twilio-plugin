async function setupPlugin({ config, global }) {
    global.baseURL = `https://api.twilio.com/2010-04-01/Accounts/${config.accountSID}/Messages.json`

    global.token = Buffer.from(`${config.accountSID}:${config.authToken}`).toString('base64')

    global.options = {
        headers: {
            'Authorization': `Basic ${global.token}`,
            'Content-Type': 'application/x-www-form-urlencoded',
        },
    }

    global.senderPhoneNumber = config.senderPhoneNumber
    
    // let's make 365 * 60 * 60 * 24 a const
    if (config.timeout <= 0 || config.timeout > 365 * 60 * 60 * 24) {
        
        // tell the user the range that is supported
        throw new Error(`timeout is not supported`)
    } else {
        global.timeout = config.timeout
    }

    const eventToNumberPairs = (config.triggeringEventsAndNumber || '').split(',').map(value => value.trim())

    global.eventAndNumberMap = {}
    for (const pair of eventToNumberPairs) {
        const [event, num] = (pair || '').split(':').map(value => value.trim())
        global.eventAndNumberMap[event] = num
    }

}

async function fetchWithRetry(url, options = {}, method = 'GET', isRetry = false) {
    try {
        const res = await fetch(url, { method: method, ...options })
        return res
    } catch {
        if (isRetry) {
            throw new Error(`${method} request to ${url} failed.`)
        }
        const res = await fetchWithRetry(url, options, (method = method), (isRetry = true))
        return res
    }
}

const jobs = {
    sendMessageWithTwilio: async (request, { global, cache }) => {
        const number = global.eventAndNumberMap[request.eventName]
        const cacheValue = await cache.get(`${request.eventName}-${number}`, null)
        if (cacheValue) {
            return null
        } 
        await cache.set(`${request.eventName}-${number}`, true, global.timeout)
            
        // let's use a string literal here e.g. `Body=Hi {request.eventName}`...
        global.options.body =
            'Body=Hi, ' +
            request.eventName +
            ' occured - PostHog&From=' +
            global.senderPhoneNumber +
            '&To=' +
            number

        const response = await fetchWithRetry(global.baseURL, global.options, 'POST')
       
        return response
    },
}

async function onEvent(event, { jobs, global }) {
    if (!global.eventAndNumberMap[event.event]) {
        return null
    } 
    const request = {
       eventName: event.event,
    }
    response = await jobs.sendMessageWithTwilio(request).runNow()

    return response
}

module.exports = {
    setupPlugin,
    onEvent,
    jobs,
}
