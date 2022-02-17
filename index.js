export async function setupPlugin({ config, global }) {
  console.info(`Setting up the plugin`);

  global.baseURL = `https://api.twilio.com/2010-04-01/Accounts/${config.accountSID}/Messages.json`;

  global.token = Buffer.from(
    `${config.accountSID}:${config.authToken}`
  ).toString("base64");

  global.options = {
    headers: {
      Authorization: `Basic ${global.token}`,
      "Content-Type": "application/x-www-form-urlencoded",
    },
  };

  global.senderPhoneNumber = config.senderPhoneNumber;
  global.timeout = config.timeout;

  let pairs = (config.triggeringEventsAndNumber || "")
    .split(",")
    .map(function (value) {
      return value.trim();
    });

  global.eventAndNumberMap = {};
  for (let pair of pairs) {
    let val = (pair || "").split(":").map(function (value) {
      return value.trim();
    });
    global.eventAndNumberMap[val[0]] = val[1];
  }
  console.log(`Twillio setup successfully`);
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

export const jobs = {
  sendMessageWithTwilio: async (request, { global, cache }) => {
    const number = global.eventAndNumberMap[request.eventName];

    if (await cache.get(`${request.eventName}-${number}`, null)) {
      return;
    } else {
      await cache.set(`${request.eventName}-${number}`, true, global.timeout);
      global.options.body =
        "Body=Hi, " +
        request.eventName +
        " occured - PostHog&From=" +
        global.senderPhoneNumber +
        "&To=" +
        number;

      await fetchWithRetry(global.baseURL, global.options, "POST");
    }
  },
};

export async function onEvent(event, { jobs, global }) {
  if (!global.eventAndNumberMap[event.event]) {
    return;
  } else {
    const request = {
      eventName: event.event,
    };
    await jobs.sendMessageWithTwilio(request).runNow();
  }
}
