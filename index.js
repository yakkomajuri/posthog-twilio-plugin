async function setupPlugin({ config, global }) {
    console.info(`Setting up the plugin`)

    global.baseURL = `https://api.twilio.com/2010-04-01/Accounts/${config.accountSID}/Messages.json`

    global.token = Buffer.from(`${config.accountSID}:${config.authToken}`).toString('base64')

    global.options = {
        headers: {
            Authorization: `Basic ${global.token}`,
            'Content-Type': 'application/x-www-form-urlencoded',
        },
    }

    global.senderPhoneNumber = config.senderPhoneNumber
    if (config.timeout <= 0 || config.timeout > 365 * 60 * 60 * 24) {
        console.error(`timeout is not supported`)
        return 'timeout is not supported'
    } else {
        global.timeout = config.timeout
    }

    let pairs = (config.triggeringEventsAndNumber || '').split(',').map(function (value) {
        return value.trim()
    })

    global.eventAndNumberMap = {}
    for (let pair of pairs) {
        let val = (pair || '').split(':').map(function (value) {
            return value.trim()
        })
        global.eventAndNumberMap[val[0]] = val[1]
    }
    console.log(`Twilio setup successfully`)
    return 'Twilio setup successfully'
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
        let response = null
        const cacheValue = await cache.get(`${request.eventName}-${number}`, null)
        console.log(cacheValue)
        if (cacheValue) {
            return response
        } else {
            await cache.set(`${request.eventName}-${number}`, true, global.timeout)
            global.options.body =
                'Body=Hi, ' +
                request.eventName +
                ' occured - PostHog&From=' +
                global.senderPhoneNumber +
                '&To=' +
                number

            response = await fetchWithRetry(global.baseURL, global.options, 'POST')
        }
        return response
    },
}

async function onEvent(event, { jobs, global }) {
    let response = null
    if (!global.eventAndNumberMap[event.event]) {
        return null
    } else {
        const request = {
            eventName: event.event,
        }
        response = await jobs.sendMessageWithTwilio(request).runNow()
    }

    return response
}

module.exports = {
    setupPlugin,
    onEvent,
    jobs,
}
